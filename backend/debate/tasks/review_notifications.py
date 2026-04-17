import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from debate.models import GeneratedDebateCandidate
from debate.services import GeneratedDebateCandidateService

logger = logging.getLogger(__name__)


def _get_debate_review_url(candidate: GeneratedDebateCandidate) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/d/{candidate.debate.slug}"


def _send_discord_message(candidate: GeneratedDebateCandidate, content: str) -> None:
    debate_url = _get_debate_review_url(candidate)
    embed = {
        "title": candidate.debate.title,
        "description": f"Status: {candidate.get_status_display()}",
        "url": debate_url,
    }
    if candidate.debate.image:
        embed["image"] = {"url": candidate.debate.image.url}

    payload_data = {
        "content": f"{content}\n\nDraft debate URL: {debate_url}",
        "embeds": [embed],
    }

    payload = json.dumps(payload_data).encode("utf-8")
    request = Request(
        settings.AUTO_DEBATE_DISCORD_WEBHOOK_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "curl/8.0.1",
        },
        method="POST",
    )
    with urlopen(request, timeout=10):
        return

def send_generated_debate_candidates_to_discord() -> int:
    if not settings.AUTO_DEBATE_DISCORD_WEBHOOK_URL:
        logger.info("Skipping generated debate review notification: no Discord webhook configured")
        return 0

    candidates = GeneratedDebateCandidate.objects.filter(
        status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        review_requested_at__isnull=True,
    )[: settings.AUTO_DEBATE_GENERATION_CANDIDATE_COUNT]

    sent_count = 0
    for candidate in candidates:
        try:
            _send_discord_message(
                candidate,
                GeneratedDebateCandidateService.build_review_payload(candidate),
            )
        except (HTTPError, URLError) as exc:
            logger.warning(
                "Failed to send generated debate review notification for candidate %s: %s",
                candidate.pk,
                exc,
            )
            continue

        candidate.review_requested_at = timezone.now()
        candidate.save(update_fields=["review_requested_at", "updated_at"])
        sent_count += 1

    return sent_count
