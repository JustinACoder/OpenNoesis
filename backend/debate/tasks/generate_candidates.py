import logging
from dataclasses import dataclass
from textwrap import dedent

from celery import shared_task
from django.conf import settings
from openai import OpenAI
from pydantic import BaseModel, Field

from debate.reddit_retrieval import RedditDebateSeedSelection, run_reddit_debate_seed_selection_pipeline
from debate.services import GeneratedDebateCandidateService
from debate.tasks.review_notifications import send_generated_debate_candidates_to_discord

logger = logging.getLogger(__name__)


@dataclass
class GeneratedDebatePipelineResult:
    created_or_updated: int = 0
    duplicates_skipped: int = 0
    invalid_candidates_skipped: int = 0
    discord_notifications_sent: int = 0


DEBATE_GENERATION_PROMPT_TEMPLATE = dedent(
    """
    ## Overview
    You are writing one debate candidate for OpenNoesis from a previously selected Reddit seed.

    The seed was already filtered for debate potential. Your job is to turn it into a clean, publishable debate candidate
    that feels broadly understandable, naturally arguable, and not overly dependent on one fleeting news cycle.

    You must use web search before writing. Search broadly enough to verify the topic, understand the larger context,
    and ground the debate in current reporting or source material.

    Selected Reddit seed
    - Subreddit: r/{subreddit}
    - Source post title: {source_post_title}
    - Source post URL: {source_post_url}
    - Suggested debate statement: {suggested_debate_statement}
    - Why this seed was selected: {selection_reason}

    Use the suggested debate statement as the default framing unless web search shows that a slightly different wording
    would produce a cleaner, more durable debate. Keep the final debate broad enough to matter, but never so broad that
    it becomes vague or generic.

    Avoid near-duplicate titles and avoid restating the same debate in only slightly different words.

    ## Quality Bar
    Only write debates that feel homepage-worthy.

    Great debate seeds often look like these:
    - A broad work/life conflict: office work versus remote work
    - A broad fairness conflict: whether transgender women should compete in women's Olympic events
    - A broad personal-finance argument: whether standard retirement advice fits most people
    - A broad family/privacy conflict: whether parents should monitor their teenagers' private messages

    Weak debate seeds often look like these:
    - A pure breaking-news headline that matters only because it happened today
    - A highly technical or niche policy update that needs lots of context to parse
    - A petty interpersonal drama that does not generalize into a broader principle
    - A discussion prompt that cannot become a clean proposition without sounding forced
    - A personality-driven controversy that is only interesting because a famous person did something provocative this week
    - A broad liability or policy claim that only feels relevant because one shocking incident made the news

    If the Reddit seed seems narrower than it first appears, generalize carefully to the broader principle without inventing a different debate.
    If the broadest honest framing still feels too event-driven, too niche, or not interesting enough for a homepage slot, do not force a weak debate.

    ## Title Rules
    Write a short statement that people can clearly be for or against.

    Rules:
    - Maximum 15 words.
    - Do not write a question.
    - Make it specific enough to be meaningful.
    - Make it broad enough to interest many users.
    - Avoid slogan-like or rage-bait wording.
    - Prefer durable framing over temporary headline framing.

    Good examples:
    - Streaming services should release full seasons at once
    - Working from the office is better than working remotely
    - Transgender women should be allowed to compete in women's Olympic events
    - Maxing out retirement contributions is not the best move for most people
    - Parents should be allowed to monitor their teenagers' private messages

    Bad examples:
    - How do you feel about this new defense spending proposal?
    - This one Trump plan proves domestic spending is dead
    - Politicians should not use religious imagery to portray themselves as sacred figures
    - My roommate violated my privacy and I was right to snap
    - Gen Z is making analog cool again

    ## Description Rules
    Write a clear debate description that explains what the debate is really about.

    Rules:
    - You must use web search to write a complete and verified description.
    - The description must never exceed 1500 words.
    - Write naturally and clearly, not like an encyclopedia and not like a personal blog post.
    - Use high school level language at most for everyday subjects, unless the topic truly requires more precision.
    - Explain the broader context, the central tradeoff, and why people genuinely disagree.
    - If the seed came from a narrow incident, expand to the broader principle and mention the incident only as context when useful.
    - Stay neutral. Describe the tradeoff well without pushing one side.
    - Do not invent facts, numbers, timelines, or quotes.

    ## Markdown Rules
    The description supports this markdown:
    - Paragraphs
    - Bold and italics
    - Inline code and fenced code blocks
    - Bulleted and numbered lists
    - Blockquotes
    - Tables
    - Standard markdown links

    Use markdown only when it improves readability. Do not force a table or code block into every answer.

    ## Source Citation Rules
    Sources are required.

    Rules:
    - Cite sources inline in the description.
    - Each source mention must be clickable and use this exact pattern: ([Source Name](https://example.com))
    - Prefer recognizable source names.
    - Cite claims close to where they are used.
    - Also return 2-5 direct source URLs in `source_links`.

    ## Output
    Return structured output only.
    """
).strip()


class GeneratedDebateCandidateOutput(BaseModel):
    title: str
    short_description: str
    generated_description: str
    source_links: list[str] = Field(default_factory=list)


class GeneratedDebateCandidatesOutput(BaseModel):
    candidates: list[GeneratedDebateCandidateOutput] = Field(default_factory=list)


def _build_debate_generation_prompt(seed_selection: RedditDebateSeedSelection) -> str:
    post = seed_selection.shortlist_item.post
    return DEBATE_GENERATION_PROMPT_TEMPLATE.format(
        subreddit=post.subreddit,
        source_post_title=post.title,
        source_post_url=post.url,
        suggested_debate_statement=seed_selection.suggested_debate_statement,
        selection_reason=seed_selection.reason,
    )


def _request_debate_generation_response(client: OpenAI, prompt: str):
    return client.responses.parse(
        model=settings.OPENAI_MODEL,
        tools=[{"type": "web_search"}],
        input=[
            {
                "role": "system",
                "content": (
                    "You draft timely, neutral debate candidates for OpenNoesis. "
                    "Return only structured output that matches the provided schema."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        reasoning={"effort": "low"},
        text_format=GeneratedDebateCandidatesOutput,
        max_output_tokens=max(settings.AI_MAX_OUTPUT_TOKENS, 4000),
    )


def _get_refusal_text(response) -> str:
    for item in getattr(response, "output", []) or []:
        for content_item in getattr(item, "content", []) or []:
            refusal = getattr(content_item, "refusal", None)
            if isinstance(refusal, str) and refusal.strip():
                return refusal.strip()

    return ""


def _parse_candidates_response(response) -> GeneratedDebateCandidatesOutput:
    output_parsed = getattr(response, "output_parsed", None)
    if output_parsed is not None:
        return output_parsed

    incomplete_reason = getattr(getattr(response, "incomplete_details", None), "reason", None)
    if incomplete_reason:
        raise RuntimeError(
            "OpenAI candidate generation returned no structured output "
            f"(status={getattr(response, 'status', None)!r}, reason={incomplete_reason!r})"
        )

    refusal = _get_refusal_text(response)
    if refusal:
        raise RuntimeError(f"OpenAI candidate generation refused the request: {refusal}")

    raise RuntimeError("OpenAI candidate generation returned no structured output")


def _validate_minimum_candidates(
    parsed_output: GeneratedDebateCandidatesOutput,
    minimum_candidates: int,
) -> GeneratedDebateCandidatesOutput:
    if minimum_candidates > 0 and len(parsed_output.candidates) < minimum_candidates:
        raise RuntimeError(
            f"OpenAI candidate generation returned {len(parsed_output.candidates)} candidate(s), "
            f"below the requested minimum of {minimum_candidates}"
        )

    return parsed_output


def _generate_candidates_from_reddit(minimum_candidates: int = 0) -> list[GeneratedDebateCandidateOutput]:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=max(settings.OPENAI_TIMEOUT_SECONDS, 60),
    )
    selection_limit = max(settings.AUTO_DEBATE_GENERATION_CANDIDATE_COUNT, minimum_candidates)
    selection_result = run_reddit_debate_seed_selection_pipeline(
        selection_limit=selection_limit,
        shortlist_limit=max(selection_limit * 3, selection_limit),
        per_subreddit_limit=25,
        per_subreddit_rank_limit=3,
        openai_client=client,
    )
    selected_seeds = selection_result.selected
    if minimum_candidates > 0 and len(selected_seeds) < minimum_candidates:
        raise RuntimeError(
            f"Reddit seed selection returned {len(selected_seeds)} candidate(s), "
            f"below the requested minimum of {minimum_candidates}"
        )

    generated_candidates: list[GeneratedDebateCandidateOutput] = []
    for seed_selection in selected_seeds:
        debate_prompt = _build_debate_generation_prompt(seed_selection)
        debate_response = _request_debate_generation_response(client, debate_prompt)
        parsed_debate_response = _parse_candidates_response(debate_response)
        generated_candidates.extend(parsed_debate_response.candidates[:1])

    return _validate_minimum_candidates(
        GeneratedDebateCandidatesOutput(candidates=generated_candidates),
        minimum_candidates,
    ).candidates


def run_generated_debate_pipeline(
    *,
    send_discord_notifications: bool = True,
    minimum_candidates: int = 0,
) -> GeneratedDebatePipelineResult:
    if not settings.AUTO_DEBATE_GENERATION_ENABLED:
        raise RuntimeError("AUTO_DEBATE_GENERATION_ENABLED is disabled")

    candidates = _generate_candidates_from_reddit(minimum_candidates=minimum_candidates)
    result = GeneratedDebatePipelineResult()

    for candidate in candidates:
        title = candidate.title.strip()
        short_description = candidate.short_description.strip()
        if not title or not short_description:
            result.invalid_candidates_skipped += 1
            continue

        source_links = [
            {"link": link.strip()}
            for link in candidate.source_links
            if isinstance(link, str) and link.strip()
        ]

        stored_candidate = GeneratedDebateCandidateService.create_or_update_candidate(
            title=title,
            short_description=short_description,
            generated_description=candidate.generated_description.strip(),
            source_payload={"sources": source_links},
        )
        if stored_candidate is None:
            result.duplicates_skipped += 1
            continue

        if settings.AUTO_DEBATE_IMAGE_GENERATION_ENABLED and not stored_candidate.debate.image:
            GeneratedDebateCandidateService.try_generate_cover_image(stored_candidate)
        result.created_or_updated += 1

    if result.created_or_updated > 0 and send_discord_notifications:
        result.discord_notifications_sent = send_generated_debate_candidates_to_discord()

    return result


@shared_task(name="debate.tasks.generate_debate_candidates_from_feeds")
def generate_debate_candidates_from_feeds() -> int:
    return run_generated_debate_pipeline(send_discord_notifications=True).created_or_updated
