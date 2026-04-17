import logging
import math
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone as dt_timezone
from email.utils import parsedate_to_datetime
from typing import Any, Iterable, Sequence
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests
from django.conf import settings
from django.utils import timezone
from openai import OpenAI
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

ATOM_NAMESPACE = {"atom": "http://www.w3.org/2005/Atom"}
DEFAULT_REDDIT_SUBREDDITS = (
    "changemyview",
    "unpopularopinion",
    "AmItheAsshole",
    "AskReddit",
    "news",
    "worldnews",
    "technology",
    "Futurology",
    "NoStupidQuestions",
)
DEFAULT_PER_SUBREDDIT_LIMIT = 25
DEFAULT_PER_SUBREDDIT_RANK_LIMIT = 3
DEFAULT_SHORTLIST_LIMIT = 20
DEFAULT_SELECTION_LIMIT = 5
REDDIT_REQUEST_TIMEOUT_SECONDS = 15
REDDIT_USER_AGENT = "OpenNoesisDebateRetrieval/1.0"
REDDIT_REQUEST_BACKOFF_SECONDS = (1, 5, 20, 60)
POST_URL_ID_RE = re.compile(r"/comments/(?P<post_id>[a-z0-9]+)/", re.IGNORECASE)


@dataclass(slots=True)
class RedditPost:
    subreddit: str
    title: str
    url: str
    published_at: datetime | None = None
    comment_count: int | None = None
    upvote_ratio: float | None = None
    raw_features: dict[str, float | None] = field(default_factory=dict)
    normalized_features: dict[str, float | None] = field(default_factory=dict)
    raw_score: float | None = None
    normalized_score: float = 0.0
    post_id: str | None = None
    source_url: str | None = None


@dataclass(slots=True)
class RedditShortlistItem:
    identifier: str
    heuristic_rank: int
    subreddit_rank: int
    post: RedditPost


@dataclass(slots=True)
class RedditDebateSeedSelection:
    rank: int
    identifier: str
    reason: str
    suggested_debate_statement: str
    suitability_score: float | None
    shortlist_item: RedditShortlistItem


@dataclass(slots=True)
class RedditDebateSeedSelectionResult:
    shortlist: list[RedditShortlistItem]
    selected: list[RedditDebateSeedSelection]


class ComparativeRedditSeedSelectionOutputItem(BaseModel):
    rank: int
    identifier: str
    reason: str
    suggested_debate_statement: str
    suitability_score: float | None = None


class ComparativeRedditSeedSelectionOutput(BaseModel):
    candidates: list[ComparativeRedditSeedSelectionOutputItem] = Field(default_factory=list)


def get_top_relevant_reddit_posts(
    limit: int,
    per_subreddit_limit: int = DEFAULT_PER_SUBREDDIT_LIMIT,
    subreddits: Sequence[str] | None = None,
    per_subreddit_rank_limit: int = DEFAULT_PER_SUBREDDIT_RANK_LIMIT,
    listing: str = "hot",
    request_timeout: int | float | None = None,
    session: requests.Session | None = None,
) -> list[RedditPost]:
    shortlist = build_reddit_shortlist(
        per_subreddit_limit=per_subreddit_limit,
        subreddits=subreddits,
        per_subreddit_rank_limit=per_subreddit_rank_limit,
        listing=listing,
        request_timeout=request_timeout,
        session=session,
        shortlist_limit=limit,
    )
    return [item.post for item in shortlist[:limit]]


def build_reddit_shortlist(
    *,
    per_subreddit_limit: int = DEFAULT_PER_SUBREDDIT_LIMIT,
    subreddits: Sequence[str] | None = None,
    per_subreddit_rank_limit: int = DEFAULT_PER_SUBREDDIT_RANK_LIMIT,
    listing: str = "hot",
    request_timeout: int | float | None = None,
    session: requests.Session | None = None,
    shortlist_limit: int | None = DEFAULT_SHORTLIST_LIMIT,
) -> list[RedditShortlistItem]:
    """
    Build a heuristic shortlist for later comparative LLM selection.

    This stage is intentionally retrieval-focused. It uses subreddit-normalized
    signals to prune and diversify the candidate pool, but it does not decide
    which posts are the strongest debate seeds semantically.
    """
    subreddits = tuple(subreddits or DEFAULT_REDDIT_SUBREDDITS)
    if per_subreddit_limit <= 0:
        raise ValueError("per_subreddit_limit must be greater than 0")
    if per_subreddit_rank_limit <= 0:
        raise ValueError("per_subreddit_rank_limit must be greater than 0")
    if shortlist_limit is not None and shortlist_limit <= 0:
        raise ValueError("shortlist_limit must be greater than 0 when provided")

    timeout = request_timeout or getattr(settings, "OPENAI_TIMEOUT_SECONDS", REDDIT_REQUEST_TIMEOUT_SECONDS)
    client = session or requests.Session()
    client.headers.update({"User-Agent": REDDIT_USER_AGENT})

    shortlisted_posts: list[tuple[int, RedditPost]] = []
    for subreddit in subreddits:
        posts = _fetch_subreddit_posts(
            subreddit=subreddit,
            limit=per_subreddit_limit,
            listing=listing,
            request_timeout=timeout,
            session=client,
        )
        if not posts:
            logger.info("Reddit shortlist fetch returned no posts for r/%s", subreddit)
            continue

        ranked_posts = _rank_subreddit_posts(posts)
        for subreddit_rank, post in enumerate(ranked_posts[:per_subreddit_rank_limit], start=1):
            shortlisted_posts.append((subreddit_rank, post))

    shortlisted_posts.sort(
        key=lambda item: (
            item[1].normalized_score,
            item[1].raw_features.get("log_comment_count") or -1.0,
            item[1].published_at or datetime.min.replace(tzinfo=dt_timezone.utc),
        ),
        reverse=True,
    )
    if shortlist_limit is not None:
        shortlisted_posts = shortlisted_posts[:shortlist_limit]

    shortlist = [
        RedditShortlistItem(
            identifier=f"reddit_candidate_{index}",
            heuristic_rank=index,
            subreddit_rank=subreddit_rank,
            post=post,
        )
        for index, (subreddit_rank, post) in enumerate(shortlisted_posts, start=1)
    ]
    logger.info(
        "Built Reddit heuristic shortlist with %s items across %s subreddit(s)",
        len(shortlist),
        len(subreddits),
    )
    return shortlist


def select_reddit_debate_seed_candidates(
    *,
    shortlist: Sequence[RedditShortlistItem],
    selection_limit: int = DEFAULT_SELECTION_LIMIT,
    client: OpenAI | None = None,
) -> list[RedditDebateSeedSelection]:
    """
    Run one comparative LLM pass over the shortlist.

    The heuristic layer is for retrieval and pruning. This stage is the actual
    semantic selector that decides which posts are strongest raw material for
    later debate creation.
    """
    if selection_limit <= 0:
        raise ValueError("selection_limit must be greater than 0")
    if not shortlist:
        return []
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    limited_shortlist = list(shortlist)
    request_client = client or OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=max(settings.OPENAI_TIMEOUT_SECONDS, 60),
    )
    prompt = _build_comparative_selection_prompt(
        shortlist=limited_shortlist,
        selection_limit=min(selection_limit, len(limited_shortlist)),
    )
    try:
        response = _request_comparative_selection_response(
            client=request_client,
            prompt=prompt,
        )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"OpenAI Reddit shortlist selection failed: {exc}") from exc

    try:
        parsed = _parse_comparative_selection_response(response)
    except RuntimeError:
        retry_prompt = (
            f"{prompt}\n"
            "Your previous response was invalid because it did not satisfy the required structured output schema.\n"
            'Return output matching this shape: {"candidates":[{"rank":1,"identifier":"reddit_candidate_1","reason":"...","suggested_debate_statement":"...","suitability_score":0.9}]}'
        )
        try:
            retry_response = _request_comparative_selection_response(
                client=request_client,
                prompt=retry_prompt,
            )
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"OpenAI Reddit shortlist selection retry failed: {exc}") from exc
        parsed = _parse_comparative_selection_response(retry_response)

    shortlist_by_identifier = {item.identifier: item for item in limited_shortlist}
    seen_identifiers: set[str] = set()
    selected: list[RedditDebateSeedSelection] = []
    for default_rank, candidate in enumerate(parsed.candidates, start=1):
        shortlist_item = shortlist_by_identifier.get(candidate.identifier)
        if shortlist_item is None or candidate.identifier in seen_identifiers:
            continue

        selected.append(
            RedditDebateSeedSelection(
                rank=max(candidate.rank, 1) if isinstance(candidate.rank, int) else default_rank,
                identifier=candidate.identifier,
                reason=candidate.reason.strip(),
                suggested_debate_statement=candidate.suggested_debate_statement.strip(),
                suitability_score=candidate.suitability_score,
                shortlist_item=shortlist_item,
            )
        )
        seen_identifiers.add(candidate.identifier)
        if len(selected) >= selection_limit:
            break

    selected.sort(key=lambda item: item.rank)
    for index, item in enumerate(selected, start=1):
        item.rank = index

    logger.info(
        "Selected %s Reddit debate seed candidate(s) from %s shortlisted item(s)",
        len(selected),
        len(limited_shortlist),
    )
    return selected


def run_reddit_debate_seed_selection_pipeline(
    *,
    selection_limit: int = DEFAULT_SELECTION_LIMIT,
    per_subreddit_limit: int = DEFAULT_PER_SUBREDDIT_LIMIT,
    subreddits: Sequence[str] | None = None,
    per_subreddit_rank_limit: int = DEFAULT_PER_SUBREDDIT_RANK_LIMIT,
    shortlist_limit: int | None = DEFAULT_SHORTLIST_LIMIT,
    listing: str = "hot",
    request_timeout: int | float | None = None,
    session: requests.Session | None = None,
    openai_client: OpenAI | None = None,
) -> RedditDebateSeedSelectionResult:
    shortlist = build_reddit_shortlist(
        per_subreddit_limit=per_subreddit_limit,
        subreddits=subreddits,
        per_subreddit_rank_limit=per_subreddit_rank_limit,
        listing=listing,
        request_timeout=request_timeout,
        session=session,
        shortlist_limit=shortlist_limit,
    )
    selected = select_reddit_debate_seed_candidates(
        shortlist=shortlist,
        selection_limit=selection_limit,
        client=openai_client,
    )
    return RedditDebateSeedSelectionResult(shortlist=shortlist, selected=selected)


def _build_comparative_selection_prompt(
    *,
    shortlist: Sequence[RedditShortlistItem],
    selection_limit: int,
) -> str:
    candidate_lines = []
    for item in shortlist:
        post = item.post
        published_at = post.published_at.isoformat() if post.published_at else "unknown"
        candidate_lines.append(
            "\n".join(
                [
                    f"Identifier: {item.identifier}",
                    f"Subreddit: r/{post.subreddit}",
                    f"Title: {post.title}",
                    f"URL: {post.url}",
                    f"Published: {published_at}",
                    f"Heuristic rank: {item.heuristic_rank}",
                    f"Subreddit rank: {item.subreddit_rank}",
                    f"Heuristic normalized score: {_format_prompt_number(post.normalized_score)}",
                    f"Comment count: {post.comment_count if post.comment_count is not None else 'unknown'}",
                    f"Upvote ratio: {_format_prompt_number(post.upvote_ratio)}",
                    f"Disagreement proxy: {_format_prompt_number(post.raw_features.get('disagreement'))}",
                ]
            )
        )

    return (
        "You are selecting Reddit posts that are the strongest seeds for later debate creation on OpenNoesis.\n"
        "You are not writing debates yet. You are comparatively selecting the best raw material from the shortlist.\n\n"
        "Quality bar:\n"
        "- It is better to return fewer candidates than to include weak ones.\n"
        "- Return zero candidates if none feel clearly homepage-worthy.\n"
        "- Assume most shortlisted items should still be rejected.\n\n"
        "Selection goal:\n"
        "- Prefer candidates that are broadly understandable, naturally debateable, interesting to many users, and easy to generalize into a clean debate statement.\n"
        "- Prefer candidates that describe an ongoing tension, value conflict, or everyday tradeoff.\n"
        "- Prefer candidates that can become a debate ordinary people would realistically argue about with friends, coworkers, classmates, or family.\n"
        "- Prefer candidates that lead to broad propositions, not narrow one-off incidents.\n"
        "- A specific seed is fine if it clearly opens into a broader and durable debate.\n"
        "- Taboo or high-friction topics are acceptable if they are broadly understandable and produce a clear proposition.\n"
        "- Prefer debates that feel socially live: issues people actually argue about in real life, not just things they momentarily react to in the news.\n"
        "- Prefer propositions that could still be worth debating even if the triggering post or news hook disappeared.\n"
        "- Prefer candidates where the broader debate is already recognizable without relying on a shocking anecdote to make it feel important.\n"
        "- Deprioritize candidates that are pure event updates, headline-like news items, narrow technical threads, overly geopolitical updates, or items too dependent on immediate context.\n"
        "- Strongly deprioritize candidates that stay trapped inside one anecdote, even if the anecdote is vivid.\n"
        "- Strongly deprioritize candidates whose best framing still depends on one named politician, one CEO, one viral post, one crime, or one news cycle incident.\n"
        "- Reject candidates that are mainly outrage bait, personality-driven reactions, or symbolic controversies without a broader durable proposition.\n"
        "- Reject candidates where the only plausible broader debate comes from extrapolating a single bizarre crime, accident, or scandal into a large policy claim.\n"
        "- Avoid redundancy. If multiple candidates are similar, keep the stronger and more generalizable one.\n"
        "- The heuristic score is only retrieval context. Do not treat it as the final answer.\n\n"
        "What stronger debate seeds often lead to:\n"
        "- Broad fairness conflicts: whether transgender women should be allowed to compete in women's Olympic events\n"
        "- Social-norm conflicts: whether employers should be allowed to require full-time office attendance\n"
        "- Personal-freedom conflicts: whether adults should be free to spend retirement savings less conservatively\n"
        "- Cultural and technology conflicts: whether society should push back against constant digital convenience\n"
        "- Gender, parenting, sex, religion, class, nationalism, and other taboo subjects are acceptable when the debate proposition is clear and broadly legible\n\n"
        "What weaker debate seeds often lead to:\n"
        "- A pure update on one bill, one court ruling, one military action, or one company announcement with no broader frame\n"
        "- A technical or niche issue that most users would not naturally care enough to debate\n"
        "- A descriptive trend piece that sounds interesting but does not imply a real proposition people would take sides on\n"
        "- A petty interpersonal drama that cannot be cleanly generalized beyond the people in the story\n"
        "- A debate that only feels interesting because a famous person did something provocative this week\n"
        "- A liability or policy debate that only became discussable because one weird crime or isolated scandal made a headline\n"
        "- A candidate where the debate statement has to be stretched so far from the source that it becomes artificial\n\n"
        "Examples of excellent outputs:\n"
        "- Source idea: recurring fights over trans women competing in elite women's sports\n"
        "  Good suggested debate statement: Transgender women should be allowed to compete in women's Olympic events.\n"
        "  Why it is strong: immediately legible, taboo enough to generate real disagreement, broad relevance, easy for users to take sides.\n"
        "- Source idea: recurring arguments over whether parents should monitor teenagers' phones and private messages\n"
        "  Good suggested debate statement: Parents should be allowed to monitor their teenagers' private messages.\n"
        "  Why it is strong: common real-life conflict, clear values clash, broad relevance across families and privacy norms.\n"
        "- Source idea: complaints that office work would be more attractive if commuting were cheaper\n"
        "  Good suggested debate statement: Working from the office is better than working remotely.\n"
        "  Why it is strong: broad work-life relevance, clear tradeoff, direct proposition instead of a prediction about public preference.\n"
        "- Source idea: pushback against standard financial advice that everyone should max retirement accounts\n"
        "  Good suggested debate statement: Maxing out retirement contributions is not the best financial move for most people.\n"
        "  Why it is strong: broadly relatable, naturally arguable, not dependent on one event.\n"
        "- Source idea: analog revival stories only if they imply a stronger conflict about how people should live\n"
        "  Good suggested debate statement: People should actively limit digital convenience in daily life.\n"
        "  Why it is strong: broader lifestyle conflict, not just a descriptive trend headline.\n\n"
        "Examples of bad outputs:\n"
        "- Source idea: complaints that office work would be more attractive if commuting were cheaper\n"
        "  Bad suggested debate statement: If commuting costs were much lower, most people would prefer working from the office.\n"
        "  Why it is weak: predicts what other people would prefer instead of stating the actual proposition users should debate.\n"
        "- Source idea: one stranger moved someone's wheelchair without permission\n"
        "  Bad suggested debate statement: Strangers should never move someone's wheelchair without permission.\n"
        "  Why it is weak here: too narrow and anecdote-bound unless the source clearly opens into a much broader autonomy norm that many users would debate.\n"
        "- Source idea: one politician posted a provocative AI-generated image this week\n"
        "  Bad suggested debate statement: Politicians should not use religious imagery to portray themselves as sacred figures.\n"
        "  Why it is weak here: too driven by one headline and one personality unless the source clearly points to a broader, independently live public debate.\n"
        "- Source idea: one bizarre crime got linked to an AI model in a headline\n"
        "  Bad suggested debate statement: AI companies should be legally liable for harmful actions that result directly from their models' outputs.\n"
        "  Why it is weak here: may be a real policy issue in general, but if this shortlist item only makes it feel live because of one shocking incident, reject it instead of stretching from anecdote to policy.\n"
        "- Source idea: a trend article about Gen Z buying analog products\n"
        "  Bad suggested debate statement: People should prioritize analog technologies and products over digital alternatives.\n"
        "  Why it is weak here: too abstract and not obviously a live argument for most users unless the source points to a stronger underlying conflict.\n"
        "- Source idea: an embarrassing roommate bathroom story\n"
        "  Bad suggested debate statement: You're justified in confronting a roommate who repeatedly intrudes on your bathroom privacy.\n"
        "  Why it is weak: too situational and small-scale for homepage-quality debate.\n\n"
        "For each selected candidate, also provide a suggested debate statement.\n"
        "The suggested debate statement should be a short, clean proposition that people can clearly be for or against.\n"
        "It should sound natural on the site, not like a headline, question, or summary sentence.\n"
        "Prefer atomic propositions that make one direct claim users can support or oppose.\n"
        "Prefer propositions about norms, rights, policies, tradeoffs, or values people actually argue about.\n"
        "Avoid framing the debate as a prediction about what most people would do, think, prefer, or secretly want.\n"
        "Avoid sociological or explanatory framing when a cleaner direct proposition is available.\n"
        "Prefer propositions that are general enough to matter, specific enough to argue, and socially interesting enough that many users would care.\n"
        "If the cleanest available proposition still feels niche, too event-bound, or not compelling enough for a homepage slot, reject the candidate instead of forcing it.\n\n"
        f"Return the best {selection_limit} candidate(s) from the shortlist below, ranked relative to one another.\n"
        "Return only structured output.\n\n"
        "Shortlist:\n\n"
        + "\n\n".join(candidate_lines)
    )


def _request_comparative_selection_response(*, client: OpenAI, prompt: str):
    return client.responses.parse(
        model=settings.OPENAI_MODEL,
        input=[
            {
                "role": "system",
                "content": (
                    "You select the strongest Reddit posts for later debate creation. "
                    "Return only structured output that matches the provided schema."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        reasoning={"effort": "medium"},
        text_format=ComparativeRedditSeedSelectionOutput,
        max_output_tokens=max(settings.AI_MAX_OUTPUT_TOKENS, 3000),
    )


def _get_refusal_text(response) -> str:
    for item in getattr(response, "output", []) or []:
        for content_item in getattr(item, "content", []) or []:
            refusal = getattr(content_item, "refusal", None)
            if isinstance(refusal, str) and refusal.strip():
                return refusal.strip()
    return ""


def _parse_comparative_selection_response(response) -> ComparativeRedditSeedSelectionOutput:
    output_parsed = getattr(response, "output_parsed", None)
    if output_parsed is not None:
        return output_parsed

    incomplete_reason = getattr(getattr(response, "incomplete_details", None), "reason", None)
    if incomplete_reason:
        raise RuntimeError(
            "OpenAI Reddit shortlist selection returned no structured output "
            f"(status={getattr(response, 'status', None)!r}, reason={incomplete_reason!r})"
        )

    refusal = _get_refusal_text(response)
    if refusal:
        raise RuntimeError(f"OpenAI Reddit shortlist selection refused the request: {refusal}")

    raise RuntimeError("OpenAI Reddit shortlist selection returned no structured output")


def _fetch_subreddit_posts(
    *,
    subreddit: str,
    limit: int,
    listing: str,
    request_timeout: int | float,
    session: requests.Session,
) -> list[RedditPost]:
    posts = _fetch_subreddit_rss_posts(
        subreddit=subreddit,
        limit=limit,
        listing=listing,
        request_timeout=request_timeout,
        session=session,
    )
    if not posts:
        return []

    enrichment_by_post_id = _fetch_subreddit_listing_metadata(
        subreddit=subreddit,
        limit=limit,
        listing=listing,
        request_timeout=request_timeout,
        session=session,
    )
    _enrich_posts_from_listing(posts, enrichment_by_post_id)
    return posts


def _fetch_subreddit_rss_posts(
    *,
    subreddit: str,
    limit: int,
    listing: str,
    request_timeout: int | float,
    session: requests.Session,
) -> list[RedditPost]:
    url = f"https://www.reddit.com/r/{subreddit}/{listing}/.rss?limit={limit}"
    response = _request_with_backoff(
        session=session,
        url=url,
        request_timeout=request_timeout,
        context=f"Reddit RSS for r/{subreddit}",
    )
    if response is None:
        return []

    try:
        root = ElementTree.fromstring(response.content)
    except ElementTree.ParseError as exc:
        logger.warning("Failed to parse Reddit RSS for r/%s: %s", subreddit, exc)
        return []

    posts: list[RedditPost] = []
    for entry in root.findall("atom:entry", ATOM_NAMESPACE):
        title = _get_atom_text(entry, "atom:title")
        if not title:
            continue

        post_url = _extract_atom_link(entry)
        if not post_url:
            continue

        published_at = _parse_datetime(
            _get_atom_text(entry, "atom:published") or _get_atom_text(entry, "atom:updated")
        )
        posts.append(
            RedditPost(
                subreddit=subreddit,
                title=title.strip(),
                url=post_url,
                published_at=published_at,
                post_id=(
                    _extract_post_id_from_url(post_url)
                    or _extract_post_id_from_text(_get_atom_text(entry, "atom:id"))
                ),
            )
        )

    return posts


def _fetch_subreddit_listing_metadata(
    *,
    subreddit: str,
    limit: int,
    listing: str,
    request_timeout: int | float,
    session: requests.Session,
) -> dict[str, dict[str, Any]]:
    """
    Fetch richer metadata from Reddit's public JSON listing.

    RSS stays the lightweight discovery source. JSON enrichment is optional and
    adds fields the heuristic and debugging views can use when Reddit exposes them.
    """
    url = f"https://www.reddit.com/r/{subreddit}/{listing}.json?limit={limit}&raw_json=1"
    response = _request_with_backoff(
        session=session,
        url=url,
        request_timeout=request_timeout,
        context=f"Reddit JSON listing for r/{subreddit}",
    )
    if response is None:
        return {}

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning("Failed to decode Reddit JSON listing for r/%s: %s", subreddit, exc)
        return {}

    metadata: dict[str, dict[str, Any]] = {}
    for child in payload.get("data", {}).get("children", []):
        data = child.get("data") or {}
        post_id = data.get("id")
        if not post_id:
            continue

        metadata[post_id] = {
            "comment_count": _coerce_int(data.get("num_comments")),
            "upvote_ratio": _coerce_float(data.get("upvote_ratio")),
            "url": _absolute_reddit_url(data.get("permalink")) or data.get("url_overridden_by_dest") or data.get("url"),
            "source_url": data.get("url_overridden_by_dest") or data.get("url"),
            "published_at": _parse_unix_timestamp(data.get("created_utc")),
        }

    return metadata


def _enrich_posts_from_listing(posts: Iterable[RedditPost], enrichment_by_post_id: dict[str, dict[str, Any]]) -> None:
    for post in posts:
        if not post.post_id:
            continue
        enrichment = enrichment_by_post_id.get(post.post_id)
        if not enrichment:
            continue

        post.comment_count = enrichment["comment_count"]
        post.upvote_ratio = enrichment["upvote_ratio"]
        post.url = enrichment["url"] or post.url
        post.source_url = enrichment["source_url"]
        post.published_at = enrichment["published_at"] or post.published_at


def _rank_subreddit_posts(posts: Sequence[RedditPost]) -> list[RedditPost]:
    for post in posts:
        log_comment_count = (
            math.log1p(post.comment_count)
            if post.comment_count is not None and post.comment_count >= 0
            else None
        )
        disagreement = 1.0 - post.upvote_ratio if post.upvote_ratio is not None else None
        post.raw_features = {
            "log_comment_count": log_comment_count,
            "disagreement": disagreement,
        }
        post.raw_score = (
            log_comment_count * disagreement
            if log_comment_count is not None and disagreement is not None
            else None
        )

    normalized_comments = _percentile_normalize([post.raw_features["log_comment_count"] for post in posts])
    normalized_disagreement = _percentile_normalize([post.raw_features["disagreement"] for post in posts])

    for index, post in enumerate(posts):
        post.normalized_features = {
            "normalized_comments": normalized_comments[index],
            "normalized_disagreement": normalized_disagreement[index],
        }
        post.normalized_score = _combine_normalized_features(
            normalized_comments=normalized_comments[index],
            normalized_disagreement=normalized_disagreement[index],
        )

    return sorted(
        posts,
        key=lambda post: (
            post.normalized_score,
            post.raw_features.get("log_comment_count") or -1.0,
            post.published_at or datetime.min.replace(tzinfo=dt_timezone.utc),
        ),
        reverse=True,
    )


def _combine_normalized_features(
    *,
    normalized_comments: float | None,
    normalized_disagreement: float | None,
) -> float:
    weights = []
    if normalized_comments is not None:
        weights.append((0.7, normalized_comments))
    if normalized_disagreement is not None:
        weights.append((0.3, normalized_disagreement))
    if not weights:
        return 0.0

    total_weight = sum(weight for weight, _ in weights)
    weighted_sum = sum(weight * value for weight, value in weights)
    return weighted_sum / total_weight


def _percentile_normalize(values: Sequence[float | None]) -> list[float | None]:
    """
    Convert values to within-subreddit percentiles.

    Percentiles are robust enough for a small v1 shortlist and preserve the
    fairness goal that large subreddits should not dominate on raw scale alone.
    """
    valid_entries = [(index, value) for index, value in enumerate(values) if value is not None]
    if not valid_entries:
        return [None] * len(values)
    if len(valid_entries) == 1:
        normalized = [None] * len(values)
        normalized[valid_entries[0][0]] = 0.5
        return normalized

    sorted_entries = sorted(valid_entries, key=lambda item: item[1])
    percentiles = [None] * len(values)
    denominator = len(sorted_entries) - 1
    position = 0
    while position < len(sorted_entries):
        value = sorted_entries[position][1]
        end = position
        while end + 1 < len(sorted_entries) and sorted_entries[end + 1][1] == value:
            end += 1

        average_rank = (position + end) / 2
        percentile = average_rank / denominator
        for tie_position in range(position, end + 1):
            original_index = sorted_entries[tie_position][0]
            percentiles[original_index] = percentile
        position = end + 1

    return percentiles


def _get_atom_text(entry: ElementTree.Element, path: str) -> str | None:
    node = entry.find(path, ATOM_NAMESPACE)
    if node is None or node.text is None:
        return None
    return node.text.strip()


def _extract_atom_link(entry: ElementTree.Element) -> str | None:
    for link in entry.findall("atom:link", ATOM_NAMESPACE):
        href = link.attrib.get("href")
        if href:
            return href
    return None


def _extract_post_id_from_text(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"t3_([a-z0-9]+)", value, flags=re.IGNORECASE)
    if match:
        return match.group(1).lower()
    return None


def _extract_post_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    match = POST_URL_ID_RE.search(urlparse(url).path)
    if not match:
        return None
    return match.group("post_id").lower()


def _absolute_reddit_url(path_or_url: str | None) -> str | None:
    if not path_or_url:
        return None
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    if path_or_url.startswith("/"):
        return f"https://www.reddit.com{path_or_url}"
    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None

    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def _parse_unix_timestamp(value: Any) -> datetime | None:
    timestamp = _coerce_float(value)
    if timestamp is None:
        return None
    return datetime.fromtimestamp(timestamp, tz=dt_timezone.utc)


def _coerce_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_prompt_number(value: float | None) -> str:
    if value is None:
        return "unknown"
    return f"{value:.3f}"


def _request_with_backoff(
    *,
    session: requests.Session,
    url: str,
    request_timeout: int | float,
    context: str,
):
    last_exception: requests.RequestException | None = None
    for attempt, delay_seconds in enumerate(REDDIT_REQUEST_BACKOFF_SECONDS, start=1):
        try:
            response = session.get(url, timeout=request_timeout)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_exception = exc
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            logger.warning(
                "Failed to fetch %s on attempt %s/%s (status=%s): %s",
                context,
                attempt,
                len(REDDIT_REQUEST_BACKOFF_SECONDS),
                status_code,
                exc,
            )
            if attempt == len(REDDIT_REQUEST_BACKOFF_SECONDS):
                break
            time.sleep(delay_seconds)

    logger.warning("Exhausted Reddit retries for %s: %s", context, last_exception)
    return None
