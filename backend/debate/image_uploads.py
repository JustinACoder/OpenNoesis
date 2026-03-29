import base64
from io import BytesIO
from typing import Optional

from django.conf import settings
from django.core.files.base import ContentFile
from ninja.files import UploadedFile
from openai import OpenAI, OpenAIError
from PIL import Image, UnidentifiedImageError

IMAGE_MIME_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "webp": "image/webp",
}
PIL_FORMAT_TO_EXTENSION = {
    "PNG": "png",
    "JPEG": "jpg",
    "WEBP": "webp",
}


class DebateImageError(Exception):
    status_code = 400


class DebateImageValidationError(DebateImageError):
    pass


class DebateImageModerationError(DebateImageError):
    pass


class DebateImageConfigurationError(DebateImageError):
    status_code = 503

def _validate_and_identify_image(image_bytes: bytes) -> tuple[str, str]:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            image_format = image.format
            width, height = image.size
    except (UnidentifiedImageError, OSError) as exc:
        raise DebateImageValidationError("Upload a PNG, JPEG, or WEBP image.") from exc

    image_extension = PIL_FORMAT_TO_EXTENSION.get(image_format)
    if image_extension is None:
        raise DebateImageValidationError("Upload a PNG, JPEG, or WEBP image.")

    total_pixels = width * height
    if total_pixels > settings.DEBATE_IMAGE_MAX_PIXELS:
        max_megapixels = settings.DEBATE_IMAGE_MAX_PIXELS / 1_000_000
        raise DebateImageValidationError(
            f"Images must be {max_megapixels:g} megapixels or smaller."
        )

    aspect_ratio = width / height
    if (
        aspect_ratio < settings.DEBATE_IMAGE_MIN_ASPECT_RATIO
        or aspect_ratio > settings.DEBATE_IMAGE_MAX_ASPECT_RATIO
    ):
        min_ratio = settings.DEBATE_IMAGE_MIN_ASPECT_RATIO
        max_ratio = settings.DEBATE_IMAGE_MAX_ASPECT_RATIO
        raise DebateImageValidationError(
            f"Images must have an aspect ratio between {min_ratio:g}:1 and {max_ratio:g}:1."
        )

    return image_extension, IMAGE_MIME_TYPES[image_extension]


class DebateImageUploadService:
    @staticmethod
    def prepare_image(
        uploaded_image: UploadedFile | None,
    ) -> ContentFile | None:
        if uploaded_image is None:
            return None

        image_bytes = uploaded_image.read()
        if not image_bytes:
            raise DebateImageValidationError("The uploaded image is empty.")

        if len(image_bytes) > settings.DEBATE_IMAGE_MAX_BYTES:
            max_megabytes = settings.DEBATE_IMAGE_MAX_BYTES // (1024 * 1024)
            raise DebateImageValidationError(
                f"Images must be {max_megabytes}MB or smaller."
            )

        image_extension, mime_type = _validate_and_identify_image(image_bytes)
        DebateImageUploadService._moderate_image(
            image_bytes=image_bytes,
            mime_type=mime_type,
        )

        return ContentFile(image_bytes, name=image_extension)

    @staticmethod
    def _moderate_image(*, image_bytes: bytes, mime_type: str) -> None:
        if not settings.OPENAI_API_KEY:
            raise DebateImageConfigurationError(
                "Image uploads are unavailable right now because moderation is not configured."
            )

        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
        )
        image_data = base64.b64encode(image_bytes).decode("ascii")
        try:
            response = client.moderations.create(
                model=settings.OPENAI_MODERATION_MODEL,
                input=[
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}",
                        },
                    }
                ],
            )
        except OpenAIError as exc:
            raise DebateImageConfigurationError(
                "Image uploads are unavailable right now because moderation could not be completed."
            ) from exc

        result = response.results[0]
        result_payload = result.model_dump(mode="python")
        categories = result_payload.get("categories", {})

        if categories.get("sexual") or categories.get("sexual/minors"):
            raise DebateImageModerationError(
                "That image cannot be used because it contains sexual content."
            )

        if categories.get("violence/graphic"):
            raise DebateImageModerationError(
                "That image cannot be used because it contains graphic violence."
            )
