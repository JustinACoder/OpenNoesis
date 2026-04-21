import base64
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
import os
from pathlib import Path
from threading import Lock
from textwrap import dedent

from django.core.files.base import ContentFile
from openai import OpenAI
from pydantic import BaseModel, Field

from debate.image_uploads import _validate_and_identify_image


CURATED_EVERGREEN_DEBATE_TITLES = [
    "There is a God",
    "Capitalism is immoral",
    "Abortion should be legal",
    "Euthanasia should be legal",
    "The death penalty should be abolished",
    "Healthcare should be free",
    "Private health insurance does more harm than good",
    "College is not worth the cost",
    "School uniforms should be mandatory",
    "Homework does more harm than good",
    "Standardized testing should be abolished",
    "Children should not have smartphones",
    "Social media does more harm than good",
    "TikTok should be banned",
    "AI is a net benefit to society",
    "AI art is real art",
    "AI companies should pay for copyrighted training data",
    "Remote work is better than office work",
    "A four-day workweek should become standard",
    "Minimum wage should be higher",
    "Billionaires should not exist",
    "Inheritance taxes are justified",
    "Housing is a human right",
    "Rent control does more harm than good",
    "Cars should be banned downtown",
    "Public transit should be free",
    "Nuclear energy is the future",
    "Climate action matters more than economic growth",
    "Carbon taxes are justified",
    "Meat consumption is unethical",
    "Animal testing should be banned",
    "Zoos should be abolished",
    "Hunting for sport is immoral",
    "School prayer should be allowed",
    "Religion does more harm than good",
    "Monogamy is unnatural",
    "Pornography should be banned",
    "Sex work should be legal",
    "Cheating is forgivable",
    "Marriage should expire unless renewed",
    "Kids should choose their own bedtime",
    "Homeschooling is better than public school",
    "Children should not be allowed on social media",
    "Parents should not post their children online",
    "Illegal immigration should lead to deportation",
    "Patriotism does more harm than good",
    "Military service should be mandatory",
    "Democracy is the best form of government",
    "Voting should be mandatory",
    "Felons should be allowed to vote",
    "Marijuana should be legal",
    "Defund the police is a good idea",
    "Stand-your-ground laws are justified",
    "Censorship is sometimes necessary",
    "Freedom of speech should include offensive speech",
    "Cancel culture is justified",
    "The moon landing was real",
    "Zodiac signs are meaningful",
    "The Earth is flat",
    "The media is too biased to be trusted",
    "Celebrities should stay out of politics",
    "Influencers have a negative effect on society",
    "Children should be allowed to play violent video games",
    "Loot boxes should be illegal",
    "Esports are real sports",
    "Sports betting should be legal everywhere",
    "College athletes should be paid by schools",
    "Trans women should compete in women's sports",
    "Beauty pageants should not exist",
    "Body positivity has gone too far",
    "Obesity is a choice",
    "Diet culture is more harmful than obesity",
    "Vaccines should be mandatory",
    "Organ donation should be opt-out by default",
    "Cosmetic genetic enhancement should be banned",
    "Junk food should be regulated like cigarettes",
    "Mental health is over-medicalized",
    "The internet has made people less intelligent",
    "Books are better than movies",
    "Piracy is sometimes morally acceptable",
    "The news should never use paywalls",
    "Anonymous online accounts should require identity verification",
    "Jealousy is normal in a healthy relationship",
    "Life in a small town is better than life in a big city",
    "Having children is selfish in today's world",
    "Money leads to happiness",
]

CURATED_DEBATE_IMAGE_GENERATION_MAX_ATTEMPTS = 3
CURATED_DEBATE_GENERATION_MAX_WORKERS = 10
CURATED_DEBATE_DESCRIPTION_MODEL = "gpt-5.4-mini"
CURATED_DEBATE_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
CURATED_DEBATE_IMAGE_TIMEOUT_SECONDS = 60
CURATED_DEBATE_OPENAI_TIMEOUT_SECONDS = 60
CURATED_DEBATE_MAX_OUTPUT_TOKENS = 4000
_ARTIFACT_JSON_WRITE_LOCK = Lock()


DESCRIPTION_GENERATION_PROMPT_TEMPLATE = dedent(
    """
    ## Overview
    You are writing a homepage-quality debate description for OpenNoesis.

    Debate statement
    - {title}

    Treat this title as a fixed, hardcoded evergreen debate topic. Do not rewrite it unless the output schema explicitly asks for it.

    You must use web search before writing. Search broadly enough to verify the topic, understand the larger context,
    and ground the debate in current reporting or source material.

    ## Quality Bar
    The debate should feel broadly understandable, naturally arguable, and durable.

    Weak descriptions usually fail in one of these ways:
    - They only summarize one side
    - They read like an encyclopedia or textbook
    - They assume too much specialized context
    - They turn the topic into temporary news commentary instead of an evergreen tradeoff
    - They use inflammatory or slogan-like language

    ## Description Rules
    Write a clear debate description that explains what the debate is really about.

    Rules:
    - You must use web search to write a complete and verified description.
    - The description must never exceed 1500 words.
    - Write naturally and clearly, not like an encyclopedia and not like a personal blog post.
    - Do not open by restating, paraphrasing, or rewriting the debate statement. The UI already displays the statement separately, so begin with substantive context instead.
    - Use high school level language at most for everyday subjects, unless the topic truly requires more precision.
    - Explain the broader context, the central tradeoff, and why people genuinely disagree.
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
    Do not over-structure the entire description as bullet points. Lists are fine for occasional enumeration, but the default should be readable prose paragraphs.
    If you need to compare positions, tradeoffs, or competing considerations, prefer a table over a long bullet-heavy structure.
    Do not use headings.
    If section delimiting would help, use bold text sparingly instead.
    If you introduce any section-like delimiter, it must be wrapped in bold markdown, for example `**Why the debate endures**`.
    Never place a bare section label on its own line without bold formatting.

    ## Source Citation Rules
    Sources are required.

    Rules:
    - Cite sources inline in the description.
    - Each source mention must be clickable and use this exact pattern: ([Source Name](https://example.com))
    - Prefer recognizable source names.
    - Cite claims close to where they are used.
    - Also return 2-5 direct source URLs in `source_links`.

    ## Output
    Return structured output only with these fields:
    - `short_description`: one concise summary sentence suitable for quick review
    - `generated_description`: the full markdown-friendly debate description
    - `source_links`: 2-5 direct source URLs used while writing
    """
).strip()


IMAGE_PROMPT_TEMPLATE = """# Task

Generate a high-quality thumbnail-style image for a debate website based on the following debate statement:

"{statement}"

The image should resemble a **real-world, news-style contextual scene** connected to the debate. Avoid turning it into a literal poster, infographic, or text-based explainer, but do not drift so far into abstraction that the subject becomes unclear.
The goal is **clear contextual relevance first**, with restraint rather than vagueness.

## Key guidelines:

* The image must feel **natural, candid, and realistic**, as if captured by a journalist or photographer.
* Avoid staged, symbolic, or overly conceptual visuals.
* Do not include text, titles, or graphic overlays.
* Do not be so indirect that the link to the debate becomes vague or hard to understand.
* The connection to the debate should be **clear within a second or two of looking at the image**.
* Prefer **strongly related real-world contexts** over generic mood shots or abstract atmosphere.
* Focus on **recognizable real-world context rather than abstract symbolism**.
* Prefer **human-centered or environment-based scenes** that evoke the broader issue.
* The composition should feel suitable for a modern editorial/news thumbnail.
* It is acceptable for the scene to depict the practical setting where the debate naturally shows up in real life.
* Do not default to images of people arguing, debating, facing off, protesting, or holding signs unless the subject itself is specifically about debate, protest, public disagreement, or political demonstration.
* The image should relate to the **subject matter being debated**, not to the abstract fact that people disagree about it.

## Scene examples:

Prefer concrete settings like these:

* For healthcare or insurance debates: a hospital billing desk, paperwork at a clinic counter, a patient speaking with staff, a waiting room, or a pharmacy checkout.
* For school debates: a classroom during a test, students in uniform in a hallway, a student doing homework at a kitchen table, or a parent-teacher meeting.
* For religion debates: a church exterior, a prayer group, people leaving a religious service, or a public setting where faith is visibly present.
* For work or economic debates: an office meeting, warehouse floor, storefront checkout, break room, factory line, or apartment rental showing.
* For social media or technology debates: teenagers on phones in a school or public setting, content creation equipment in a bedroom studio, or commuters absorbed in screens.

Do not default to metaphors like scales, masks, chess pieces, cracked objects, silhouettes, or generic dramatic lighting unless the debate genuinely requires that and there is no better real-world scene.

## Tone and style:

* Neutral and observational (not persuasive or biased)
* Slightly evocative or emotionally suggestive, but not exaggerated
* Visually clear at small sizes (thumbnail-friendly composition)

# Reasoning Step (important for better outputs)

Before generating the image, briefly reason about:

1. The **most recognizable real-world setting** where this debate naturally appears
2. Which people, objects, or environment would make the connection obvious quickly
3. Why this scene is clear and relevant without feeling like a literal poster or slogan

# Output format:

* Return only the final image generation
"""


class GeneratedDebateDescription(BaseModel):
    short_description: str
    generated_description: str
    source_links: list[str] = Field(default_factory=list)


@dataclass
class GeneratedDebateCoverResult:
    image: ContentFile
    reasoning: str
    mime_type: str


@dataclass
class CuratedDebateArtifact:
    title: str
    description: str
    short_description: str
    source_links: list[str]
    image_base64: str | None = None
    image_filename: str | None = None
    image_mime_type: str | None = None
    image_reasoning: str = ""


class CuratedDebateGenerationError(RuntimeError):
    pass


def _build_description_prompt(*, title: str) -> str:
    return DESCRIPTION_GENERATION_PROMPT_TEMPLATE.format(title=title.strip())


def _build_image_prompt(*, title: str) -> str:
    return IMAGE_PROMPT_TEMPLATE.format(statement=title.strip())


def _extract_text_and_image_parts(*, response) -> tuple[str, bytes | None]:
    text_parts: list[str] = []
    image_bytes = None

    for part in getattr(response, "parts", []) or []:
        text = getattr(part, "text", None)
        if text:
            text_parts.append(text)

        inline_data = getattr(part, "inline_data", None)
        data = getattr(inline_data, "data", None)
        if data and image_bytes is None:
            if isinstance(data, str):
                data = base64.b64decode(data)
            image_bytes = data

    if image_bytes is not None:
        return "\n\n".join(part.strip() for part in text_parts if part and part.strip()).strip(), image_bytes

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            text = getattr(part, "text", None)
            if text:
                text_parts.append(text)

            inline_data = getattr(part, "inline_data", None)
            data = getattr(inline_data, "data", None)
            if data and image_bytes is None:
                if isinstance(data, str):
                    data = base64.b64decode(data)
                image_bytes = data

        if image_bytes is not None:
            break

    return "\n\n".join(part.strip() for part in text_parts if part and part.strip()).strip(), image_bytes


def generate_description_from_title(*, title: str, client: OpenAI | None = None) -> GeneratedDebateDescription:
    if client is None and not os.getenv("OPENAI_API_KEY"):
        raise CuratedDebateGenerationError("OPENAI_API_KEY is not configured.")

    request_client = client or OpenAI(timeout=CURATED_DEBATE_OPENAI_TIMEOUT_SECONDS)

    response = request_client.responses.parse(
        model=CURATED_DEBATE_DESCRIPTION_MODEL,
        tools=[{"type": "web_search"}],
        input=[
            {
                "role": "system",
                "content": (
                    "You write evergreen, neutral debate descriptions for OpenNoesis. "
                    "Return only structured output that matches the provided schema."
                ),
            },
            {"role": "user", "content": _build_description_prompt(title=title)},
        ],
        reasoning={"effort": "low"},
        text_format=GeneratedDebateDescription,
        max_output_tokens=CURATED_DEBATE_MAX_OUTPUT_TOKENS,
    )

    output_parsed = getattr(response, "output_parsed", None)
    if output_parsed is not None:
        return output_parsed

    raise CuratedDebateGenerationError(
        f"OpenAI description generation returned no structured output for title: {title}"
    )


def generate_cover_from_title(*, title: str) -> GeneratedDebateCoverResult:
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
        raise CuratedDebateGenerationError("GEMINI_API_KEY is not configured.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise CuratedDebateGenerationError(
            "google-genai is not installed. Install it before running cover generation."
        ) from exc

    last_error: Exception | None = None
    for _attempt in range(CURATED_DEBATE_IMAGE_GENERATION_MAX_ATTEMPTS):
        try:
            with genai.Client(
                http_options=types.HttpOptions(
                    timeout=CURATED_DEBATE_IMAGE_TIMEOUT_SECONDS * 1000,
                ),
            ) as client:
                response = client.models.generate_content(
                    model=CURATED_DEBATE_IMAGE_MODEL,
                    contents=[
                        types.Content(
                            role="user",
                            parts=[types.Part.from_text(text=_build_image_prompt(title=title))],
                        )
                    ],
                    config=types.GenerateContentConfig(
                        temperature=1,
                        top_p=0.95,
                        max_output_tokens=32768,
                        response_modalities=["IMAGE"],
                        safety_settings=[
                            types.SafetySetting(
                                category="HARM_CATEGORY_HATE_SPEECH",
                                threshold="OFF",
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                                threshold="OFF",
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                threshold="BLOCK_MEDIUM_AND_ABOVE",
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_HARASSMENT",
                                threshold="OFF",
                            ),
                        ],
                        image_config=types.ImageConfig(
                            aspect_ratio="16:9",
                            image_size="1K",
                        ),
                    ),
                )
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

        reasoning, image_bytes = _extract_text_and_image_parts(response=response)
        if image_bytes is not None:
            image_extension, mime_type = _validate_and_identify_image(image_bytes)
            filename = f"{_slugify_filename_fragment(title)}.{image_extension}"
            return GeneratedDebateCoverResult(
                image=ContentFile(image_bytes, name=filename),
                reasoning=reasoning,
                mime_type=mime_type,
            )

        last_error = CuratedDebateGenerationError(
            f"Image generation returned no image content for title: {title}"
        )

    raise CuratedDebateGenerationError(f"Image generation failed for title: {title}") from last_error


def build_curated_artifact(*, title: str, include_images: bool = True) -> CuratedDebateArtifact:
    description_result = generate_description_from_title(title=title)
    artifact = CuratedDebateArtifact(
        title=title.strip(),
        description=description_result.generated_description.strip(),
        short_description=description_result.short_description.strip(),
        source_links=description_result.source_links,
    )

    if include_images:
        cover_result = generate_cover_from_title(title=title)
        artifact.image_base64 = base64.b64encode(cover_result.image.read()).decode("ascii")
        artifact.image_filename = cover_result.image.name
        artifact.image_mime_type = cover_result.mime_type
        artifact.image_reasoning = cover_result.reasoning

    return artifact


def generate_curated_debate_artifacts(*, titles: list[str], include_images: bool = True) -> list[CuratedDebateArtifact]:
    return list(iter_generated_curated_debate_artifacts(titles=titles, include_images=include_images))


def iter_generated_curated_debate_artifacts(
    *,
    titles: list[str],
    include_images: bool = True,
):
    if len(titles) <= 1:
        for title in titles:
            yield build_curated_artifact(title=title, include_images=include_images)
        return

    max_workers = min(CURATED_DEBATE_GENERATION_MAX_WORKERS, len(titles))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(build_curated_artifact, title=debate_title, include_images=include_images): debate_title
            for debate_title in titles
        }
        try:
            for future in as_completed(futures):
                yield future.result()
        except Exception:
            for pending_future in futures:
                pending_future.cancel()
            raise


def save_artifacts_to_json(*, artifacts: list[CuratedDebateArtifact], output_path: str | Path) -> Path:
    path = Path(output_path)
    payload = {
        "generated_by": "generate_curated_debates_json",
        "debates": [asdict(artifact) for artifact in artifacts],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized_payload = json.dumps(payload, indent=2)
    temp_path = path.with_name(f"{path.name}.tmp")
    with _ARTIFACT_JSON_WRITE_LOCK:
        temp_path.write_text(serialized_payload, encoding="utf-8")
        temp_path.replace(path)
    return path


def load_artifacts_from_json(*, output_path: str | Path) -> list[CuratedDebateArtifact]:
    path = Path(output_path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    debates = payload.get("debates", [])
    return [CuratedDebateArtifact(**artifact) for artifact in debates]


def merge_artifacts_for_output(
    *,
    existing_artifacts: list[CuratedDebateArtifact],
    new_artifacts: list[CuratedDebateArtifact],
) -> list[CuratedDebateArtifact]:
    merged_artifacts_by_title = {artifact.title: artifact for artifact in existing_artifacts}
    merged_artifacts_by_title.update({artifact.title: artifact for artifact in new_artifacts})
    ordered_titles = [artifact.title for artifact in existing_artifacts]
    ordered_titles.extend(artifact.title for artifact in new_artifacts if artifact.title not in ordered_titles)
    return [merged_artifacts_by_title[title] for title in ordered_titles]


def load_existing_and_pending_artifacts(
    *,
    titles: list[str],
    output_path: str | Path,
    fresh: bool = False,
) -> tuple[list[CuratedDebateArtifact], list[str]]:
    path = Path(output_path)
    existing_artifacts: list[CuratedDebateArtifact] = []

    if path.exists() and not fresh and path.stat().st_size > 0:
        existing_artifacts = load_artifacts_from_json(output_path=path)

    existing_artifacts_by_title = {artifact.title: artifact for artifact in existing_artifacts}
    titles_to_generate = [title for title in titles if title not in existing_artifacts_by_title]
    return existing_artifacts, titles_to_generate


def decode_artifact_image(*, artifact: dict) -> ContentFile | None:
    image_base64 = artifact.get("image_base64")
    if not image_base64:
        return None

    image_bytes = base64.b64decode(image_base64)
    image_filename = artifact.get("image_filename") or "generated-cover.jpg"
    return ContentFile(image_bytes, name=image_filename)


def _slugify_filename_fragment(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    cleaned = "-".join(part for part in cleaned.split("-") if part)
    return cleaned[:80] or "generated-cover"
