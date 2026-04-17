import base64
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from google import genai
from google.genai import types

from debate.image_uploads import _validate_and_identify_image


@dataclass
class GeneratedDebateCoverResult:
    image: ContentFile
    reasoning: str


class GeneratedDebateCoverError(Exception):
    pass


PROMPT_TEMPLATE = """# Task

Generate a high-quality thumbnail-style image for a debate website based on the following debate statement:

"{statement}"

The image should **not directly illustrate the debate statement** or explicitly depict the topic. Instead, it should resemble a **real-world, news-style contextual scene** that subtly relates to the underlying theme.

## Key guidelines:

* The image must feel **natural, candid, and realistic**, as if captured by a journalist or photographer.
* Avoid staged, symbolic, or overly conceptual visuals.
* Do not include text, titles, or graphic overlays.
* Focus on **indirect contextual relevance** rather than literal representation.
* The connection to the debate should be **interpretable but not obvious**.
* Prefer **human-centered or environment-based scenes** that evoke the broader issue.
* The composition should feel suitable for a modern editorial/news thumbnail.

## Tone and style:

* Neutral and observational (not persuasive or biased)
* Slightly evocative or emotionally suggestive, but not exaggerated
* Visually clear at small sizes (thumbnail-friendly composition)

# Reasoning Step (important for better outputs)

Before generating the image, briefly reason about:

1. The **core underlying theme(s)** of the debate (e.g., freedom, safety, inequality, technology, etc.)
2. A **real-life scenario** where these themes naturally appear
3. Why this scene provides **indirect but meaningful context**

# Output format:

* Short reasoning (2–4 sentences)
* Then the final image generation

## Examples

### Example 1

**Debate:** "Social media should be banned for teenagers"

**Reasoning:**
The core themes are youth behavior, digital exposure, and social influence. A natural contextual scene could involve teenagers interacting with phones in a casual setting, without emphasizing addiction or conflict.

**Good image ideas:**

* A group of teenagers sitting together, all quietly looking at their phones
* A teen alone in a dimly lit bedroom illuminated by a phone screen
* Students in a school hallway, some engaged, others distracted by devices

### Example 2

**Debate:** "Public surveillance improves safety"

**Reasoning:**
Themes include security, monitoring, and public spaces. A subtle contextual image could show infrastructure rather than explicitly highlighting surveillance as the subject.

**Good image ideas:**

* A quiet city street at night with visible streetlights and a security camera in the corner
* A subway station platform with commuters and subtle overhead cameras
* A public square with people going about daily life under structured urban design

### Example 3

**Debate:** "Remote work is better than office work"

**Reasoning:**
Themes include productivity, isolation, flexibility, and environment. A contextual image should reflect daily life rather than explicitly comparing options.

**Good image ideas:**

* A person working on a laptop at a kitchen table with natural morning light
* A café scene with multiple people working independently
* A quiet home office with a slightly informal setup"""


class GeneratedDebateCoverService:
    @staticmethod
    def _build_prompt(*, title: str) -> str:
        return PROMPT_TEMPLATE.format(statement=title.strip())

    @staticmethod
    def generate_cover(*, title: str) -> GeneratedDebateCoverResult:
        if not settings.GOOGLE_CLOUD_API_KEY:
            raise GeneratedDebateCoverError(
                "Image generation is unavailable because GOOGLE_CLOUD_API_KEY is not configured."
            )

        client_kwargs = {
            "vertexai": True,
            "api_key": settings.GOOGLE_CLOUD_API_KEY,
            "http_options": types.HttpOptions(
                timeout=settings.AUTO_DEBATE_IMAGE_GENERATION_TIMEOUT_SECONDS * 1000,
            ),
        }

        prompt = GeneratedDebateCoverService._build_prompt(title=title)

        try:
            with genai.Client(**client_kwargs) as client:
                response = client.models.generate_content(
                    model=settings.AUTO_DEBATE_IMAGE_GENERATION_MODEL,
                    contents=[
                        types.Content(
                            role="user",
                            parts=[types.Part.from_text(text=prompt)],
                        )
                    ],
                    config=types.GenerateContentConfig(
                        temperature=1,
                        top_p=0.95,
                        max_output_tokens=32768,
                        response_modalities=["TEXT", "IMAGE"],
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
                            output_mime_type="image/jpeg",
                        ),
                        thinking_config=types.ThinkingConfig(
                            thinking_level="HIGH",
                        ),
                    ),
                )
        except Exception as exc:  # noqa: BLE001
            raise GeneratedDebateCoverError(
                "Image generation failed."
            ) from exc

        image_bytes = None
        for part in getattr(response, "parts", []) or []:
            inline_data = getattr(part, "inline_data", None)
            data = getattr(inline_data, "data", None)
            if data:
                if isinstance(data, str):
                    data = base64.b64decode(data)
                image_bytes = data
                break

        if image_bytes is None:
            candidates = getattr(response, "candidates", None) or []
            for candidate in candidates:
                content = getattr(candidate, "content", None)
                for part in getattr(content, "parts", None) or []:
                    inline_data = getattr(part, "inline_data", None)
                    data = getattr(inline_data, "data", None)
                    if data:
                        if isinstance(data, str):
                            data = base64.b64decode(data)
                        image_bytes = data
                        break
                if image_bytes is not None:
                    break

        if image_bytes is None:
            raise GeneratedDebateCoverError("Image generation returned no image content.")

        image_extension, _mime_type = _validate_and_identify_image(image_bytes)
        return GeneratedDebateCoverResult(
            image=ContentFile(image_bytes, name=f"generated-cover.{image_extension}"),
            reasoning=(getattr(response, "text", "") or "").strip(),
        )
