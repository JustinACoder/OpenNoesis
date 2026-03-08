from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.db import transaction, connection
from openai import APIConnectionError, APITimeoutError, RateLimitError
import logging
from typing import Iterable

from ProjectOpenDebate.consumers import get_user_group_name
from discussion.ai import generate_ai_reply_stream
from discussion.models import DiscussionAIConfig, Message, ReadCheckpoint
from discussion.schemas import MessageSchema

logger = logging.getLogger(__name__)
AI_DISCUSSION_LOCK_NAMESPACE = 93171


def _broadcast_ai_chunk(
    discussion_id: int,
    participants: Iterable[tuple[int, bool]],
    delta: str,
    current_text: str,
):
    channel_layer = get_channel_layer()
    for participant_id, is_archived in participants:
        user_group_name = get_user_group_name("DiscussionConsumer", int(participant_id))
        async_to_sync(channel_layer.group_send)(
            user_group_name,
            {
                "status": "success",
                "event_type": "ai_message_chunk",
                "type": "send.json",
                "data": {
                    "discussion_id": discussion_id,
                    "isin_archived_discussion": is_archived,
                    "delta": delta,
                    "current_text": current_text,
                },
            },
        )

def _broadcast_ai_thinking(
    discussion_id: int,
    participants: Iterable[tuple[int, bool]],
    is_thinking: bool,
):
    channel_layer = get_channel_layer()
    for participant_id, is_archived in participants:
        user_group_name = get_user_group_name("DiscussionConsumer", int(participant_id))
        async_to_sync(channel_layer.group_send)(
            user_group_name,
            {
                "status": "success",
                "event_type": "ai_message_thinking",
                "type": "send.json",
                "data": {
                    "discussion_id": discussion_id,
                    "isin_archived_discussion": is_archived,
                    "is_thinking": is_thinking,
                },
            },
        )


def _try_acquire_discussion_lock(discussion_id: int) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_try_advisory_lock(%s, %s)",
            [AI_DISCUSSION_LOCK_NAMESPACE, discussion_id],
        )
        row = cursor.fetchone()
    return bool(row and row[0])


def _release_discussion_lock(discussion_id: int):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_unlock(%s, %s)",
            [AI_DISCUSSION_LOCK_NAMESPACE, discussion_id],
        )


@shared_task(
    bind=True,
    autoretry_for=(APITimeoutError, APIConnectionError, RateLimitError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def generate_ai_reply_for_message(self, trigger_message_id: int):
    logger.info("AI reply task started for trigger_message_id=%s", trigger_message_id)

    trigger_message = Message.objects.filter(id=trigger_message_id).only("discussion_id").first()
    if not trigger_message:
        logger.warning(
            "AI reply task aborted: trigger message %s not found",
            trigger_message_id,
        )
        return "skipped_trigger_message_not_found"

    discussion_id = trigger_message.discussion_id
    if not _try_acquire_discussion_lock(discussion_id):
        logger.info("AI reply task skipped: lock busy for discussion %s", discussion_id)
        return "skipped_lock_busy"

    processed_count = 0
    skipped_no_reply_count = 0
    last_ai_message_id = None

    try:
        while True:
            with transaction.atomic():
                ai_config = (
                    DiscussionAIConfig.objects.select_for_update()
                    .select_related("discussion", "bot_user", "discussion__debate")
                    .filter(discussion_id=discussion_id)
                    .first()
                )
                if not ai_config:
                    if processed_count:
                        break
                    logger.info(
                        "AI reply task skipped: discussion %s has no AI config",
                        discussion_id,
                    )
                    return "skipped_no_ai_config"

                last_handled_id = ai_config.last_trigger_message_id or 0
                pending_message = (
                    Message.objects.select_related("discussion__debate")
                    .filter(discussion_id=discussion_id, id__gt=last_handled_id)
                    .exclude(author_id=ai_config.bot_user_id)
                    .order_by("id")
                    .first()
                )
                if not pending_message:
                    break

                participants = [
                    (ai_config.discussion.participant1_id, ai_config.discussion.is_archived_for_p1),
                    (ai_config.discussion.participant2_id, ai_config.discussion.is_archived_for_p2),
                ]
                pending_message_id = pending_message.id
                pending_message_text = pending_message.text
                bot_user_id = ai_config.bot_user_id
                ai_config_id = ai_config.id

            _broadcast_ai_thinking(discussion_id, participants, True)
            try:
                ai_reply_text, response_id = generate_ai_reply_stream(
                    ai_config,
                    trigger_user_message=pending_message_text,
                    on_delta=lambda delta, current_text: _broadcast_ai_chunk(
                        discussion_id,
                        participants,
                        delta,
                        current_text,
                    ),
                )
                if not ai_reply_text:
                    logger.warning(
                        "AI reply task produced no reply for trigger message %s (discussion=%s)",
                        pending_message_id,
                        discussion_id,
                    )
                    with transaction.atomic():
                        ai_config_locked = (
                            DiscussionAIConfig.objects.select_for_update()
                            .filter(id=ai_config_id)
                            .first()
                        )
                        if ai_config_locked:
                            ai_config_locked.last_trigger_message_id = pending_message_id
                            ai_config_locked.last_openai_response_id = response_id
                            ai_config_locked.save(
                                update_fields=["last_trigger_message", "last_openai_response_id"]
                            )
                    skipped_no_reply_count += 1
                    continue
            finally:
                _broadcast_ai_thinking(discussion_id, participants, False)

            with transaction.atomic():
                ai_config_locked = (
                    DiscussionAIConfig.objects.select_for_update()
                    .filter(id=ai_config_id)
                    .first()
                )
                if not ai_config_locked:
                    if processed_count:
                        break
                    logger.info(
                        "AI reply task skipped during persist: AI config %s no longer exists",
                        ai_config_id,
                    )
                    return "skipped_no_ai_config_during_persist"

                ai_message = Message.objects.create(
                    discussion_id=discussion_id,
                    author_id=bot_user_id,
                    text=ai_reply_text,
                )

                ai_checkpoint, _ = ReadCheckpoint.objects.get_or_create(
                    discussion_id=discussion_id,
                    user_id=bot_user_id,
                )
                ai_checkpoint.read_until(ai_message)

                ai_config_locked.last_trigger_message_id = pending_message_id
                ai_config_locked.last_openai_response_id = response_id
                ai_config_locked.save(update_fields=["last_trigger_message", "last_openai_response_id"])

            channel_layer = get_channel_layer()
            message_data = MessageSchema.model_validate(ai_message).model_dump(mode="json")
            for participant_id, is_archived in participants:
                user_group_name = get_user_group_name("DiscussionConsumer", int(participant_id))
                async_to_sync(channel_layer.group_send)(
                    user_group_name,
                    {
                        "status": "success",
                        "event_type": "new_message",
                        "type": "send.json",
                        "data": {
                            "isin_archived_discussion": is_archived,
                            "message": message_data,
                        },
                    },
                )

            processed_count += 1
            last_ai_message_id = ai_message.id
    finally:
        _release_discussion_lock(discussion_id)

    if processed_count == 0:
        if skipped_no_reply_count > 0:
            return f"advanced_no_ai_reply_text={skipped_no_reply_count}"
        return "skipped_no_pending_user_message"

    logger.info(
        "AI reply task completed: sent %s ai messages for discussion %s "
        "(last_ai_message_id=%s, skipped_no_reply=%s)",
        processed_count,
        discussion_id,
        last_ai_message_id,
        skipped_no_reply_count,
    )
    return (
        f"sent_ai_messages={processed_count},last_ai_message_id={last_ai_message_id},"
        f"skipped_no_ai_reply_text={skipped_no_reply_count}"
    )
