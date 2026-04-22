from dataclasses import dataclass

from django.db import models


class NotificationType(models.TextChoices):
    NEW_DISCUSSION = "new_discussion", "New discussion"
    NEW_MESSAGE = "new_message", "New message"
    ACCEPTED_INVITE = "accepted_invite", "Accepted invite"


@dataclass(frozen=True)
class NotificationTemplate:
    title_template: str
    message_template: str
    endnote_template: str


NOTIFICATION_TEMPLATES = {
    NotificationType.NEW_DISCUSSION: NotificationTemplate(
        title_template="Live debate started!",
        message_template=(
            "Your request to debate on {debate_title} has been fulfilled and a live chat was "
            "created with {participant_username}."
        ),
        endnote_template="Go to chat",
    ),
    NotificationType.NEW_MESSAGE: NotificationTemplate(
        title_template="New message!",
        message_template=(
            "You have received a new message from {participant_username} on the debate "
            "{debate_title}."
        ),
        endnote_template="View message",
    ),
    NotificationType.ACCEPTED_INVITE: NotificationTemplate(
        title_template="Invite Accepted!",
        message_template=(
            "{participant_username} accepted your invite to debate on {debate_title} and a live "
            "chat was created."
        ),
        endnote_template="Go to chat",
    ),
}


def get_notification_template(notification_type: str) -> NotificationTemplate:
    try:
        normalized_type = NotificationType(notification_type)
    except ValueError as exc:
        raise ValueError(f"Unknown notification type: {notification_type}") from exc

    return NOTIFICATION_TEMPLATES[normalized_type]
