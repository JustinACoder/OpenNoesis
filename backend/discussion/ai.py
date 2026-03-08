from __future__ import annotations

import hashlib
import logging
from typing import Callable

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from openai import OpenAI

from discussion.models import DiscussionAIConfig

User = get_user_model()
logger = logging.getLogger(__name__)


def ensure_ai_bot_user():
    username = settings.AI_BOT_USERNAME
    defaults = {
        "email": settings.AI_BOT_EMAIL,
        "is_active": True,
        "is_staff": False,
        "is_superuser": False,
    }
    ai_user = User.objects.filter(username=username).first()
    created = False
    if ai_user is None:
        try:
            with transaction.atomic():
                ai_user = User.objects.create(username=username, **defaults)
                created = True
        except IntegrityError:
            # Another worker/process created the user first.
            ai_user = User.objects.get(username=username)

    changed_fields: list[str] = []

    if ai_user.email != settings.AI_BOT_EMAIL:
        ai_user.email = settings.AI_BOT_EMAIL
        changed_fields.append("email")
    if ai_user.is_staff:
        ai_user.is_staff = False
        changed_fields.append("is_staff")
    if ai_user.is_superuser:
        ai_user.is_superuser = False
        changed_fields.append("is_superuser")
    if not ai_user.is_active:
        ai_user.is_active = True
        changed_fields.append("is_active")
    if ai_user.has_usable_password():
        ai_user.set_unusable_password()
        changed_fields.append("password")

    if created and "password" not in changed_fields:
        ai_user.set_unusable_password()
        changed_fields.append("password")

    if changed_fields:
        ai_user.save(update_fields=changed_fields)

    return ai_user


def get_ai_bot_user():
    return ensure_ai_bot_user()


def _get_human_user_id(ai_config: DiscussionAIConfig) -> int | None:
    discussion = ai_config.discussion
    if discussion.participant1_id == ai_config.bot_user_id:
        return discussion.participant2_id
    if discussion.participant2_id == ai_config.bot_user_id:
        return discussion.participant1_id
    return None


def _build_safety_identifier(ai_config: DiscussionAIConfig) -> str | None:
    human_user_id = _get_human_user_id(ai_config)
    if human_user_id is None:
        return None

    raw_identifier = f"opennoesis-user:{human_user_id}".encode("utf-8")
    return hashlib.sha256(raw_identifier).hexdigest()


def _build_system_prompt(ai_config: DiscussionAIConfig) -> str:
    debate = ai_config.discussion.debate
    ai_stance = "FOR" if ai_config.ai_stance == 1 else "AGAINST"
    human_user = (
        ai_config.discussion.participant1
        if ai_config.discussion.participant1_id != ai_config.bot_user_id
        else ai_config.discussion.participant2
    )
    human_stance_value = debate.get_stance(human_user)
    human_stance = (
        "FOR" if human_stance_value == 1 else "AGAINST" if human_stance_value == -1 else "UNSET"
    )

    return (
        "<context>\n"
        "You are the built-in AI opponent in OpenNoesis, a one-on-one debate chat app.\n"
        f"Debate proposition: {debate.title}\n"
        f"Debate context: {debate.description}\n"
        f"User stance: {human_stance}\n"
        f"Your assigned side: {ai_stance}\n"
        "</context>\n\n"
        "<scope>\n"
        "Your job is to debate this proposition only.\n"
        "Do not answer arbitrary or unrelated questions (coding help, trivia, personal advice, etc.).\n"
        "Do not offer unrelated helper workflows (plans, checklists, tutorials, implementation steps).\n"
        "Do not ask follow-up questions.\n"
        "Do not end messages with questions.\n"
        "If user tries to derail, briefly redirect to the debate topic.\n"
        "Reason: keeping scope narrow prevents abuse and keeps the feature focused on debate.\n"
        "Instead of asking questions, make one concise counterpoint or rebuttal statement.\n"
        "</scope>\n\n"
        "<debate_strategy>\n"
        "Engage the user's latest point directly.\n"
        "Keep mental load low: argue one core point at a time, not a long list of points.\n"
        "Stay on that point until the conversation naturally shifts.\n"
        "Be assertive but civil.\n"
        "</debate_strategy>\n\n"
        "<style_defaults>\n"
        "Default audience level: high school.\n"
        "Use basic words and short/simple sentences.\n"
        "Use familiar everyday language, like a debate with friends.\n"
        "Avoid jargon and overly academic wording by default.\n"
        "Default to short replies; longer replies only when clearly needed.\n"
        "</style_defaults>\n\n"
        "<style_adaptation>\n"
        "Adapt to the user's style while staying clear.\n"
        "If user writes short text, respond with short text.\n"
        "Prefer conciseness over completeness.\n"
        "Messages can be very short when enough.\n"
        "When user asks for one example/counterexample, give one concise example and stop.\n"
        "If user writes longer, you may write longer.\n"
        "If user uses more professional/academic vocabulary, you may mirror some of it.\n"
        "If user uses simple language, keep it simple.\n"
        "Do not become verbose unless context demands it.\n"
        "</style_adaptation>\n\n"
        "<safety>\n"
        "Do not mention being an AI model unless explicitly asked.\n"
        "Avoid policy/legal meta-talk unless directly relevant to the user's message.\n"
        "Stay on-topic.\n"
        "</safety>"
    )


def generate_ai_reply_stream(
    ai_config: DiscussionAIConfig,
    trigger_user_message: str,
    on_delta: Callable[[str, str], None] | None = None,
) -> tuple[str | None, str | None]:
    if not settings.OPENAI_API_KEY:
        logger.warning(
            "Skipping AI reply for discussion %s: OPENAI_API_KEY is not configured",
            ai_config.discussion_id,
        )
        return None, None

    trigger_user_message = trigger_user_message.strip()
    if not trigger_user_message:
        logger.warning("Skipping AI reply for discussion %s: no user message found", ai_config.discussion_id)
        return None, None

    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT_SECONDS)
    accumulated_text = ""
    final_response = None
    safety_identifier = _build_safety_identifier(ai_config)

    with client.responses.stream(
        model=ai_config.model or settings.OPENAI_MODEL,
        instructions=_build_system_prompt(ai_config),
        reasoning={ "effort": "minimal" },
        text={ "verbosity": "low" },
        context_management=[{
            "type": "compaction",
            "compact_threshold": settings.AI_CONTEXT_COMPACTION_TRIGGER_TOKENS,
        }],
        previous_response_id=ai_config.last_openai_response_id,
        input=trigger_user_message,
        max_output_tokens=settings.AI_MAX_OUTPUT_TOKENS,
        safety_identifier=safety_identifier,
        store=True,
    ) as stream:
        for event in stream:
            event_type = getattr(event, "type", "")
            if event_type == "response.output_text.delta":
                delta = getattr(event, "delta", "") or ""
                if delta:
                    accumulated_text += delta
                    if on_delta is not None:
                        on_delta(delta, accumulated_text)
        final_response = stream.get_final_response()

    if not accumulated_text and final_response is not None:
        accumulated_text = getattr(final_response, "output_text", "") or ""

    text = accumulated_text.strip()
    response_id = getattr(final_response, "id", None) if final_response is not None else None
    if not text:
        logger.warning(
            "OpenAI Responses returned no output_text for discussion %s (model=%s)",
            ai_config.discussion_id,
            ai_config.model or settings.OPENAI_MODEL,
        )
        return None, response_id

    return text, response_id
