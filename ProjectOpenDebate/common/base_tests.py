from django.test import TestCase
from notifications.models import NotificationType

class BaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        NotificationType.objects.bulk_create([
            NotificationType(
                id=1,
                name="new_discussion",
                title_template="Live debate started!",
                message_template="Your request to debate on {debate_title} has been fulfilled and a live chat was created with {participant_username}.",
                endnote_template="Go to chat"
            ),
            NotificationType(
                id=2,
                name="new_message",
                title_template="New message!",
                message_template="You have received a new message from {participant_username} on the debate {debate_title}.",
                endnote_template="View message"
            ),
            NotificationType(
                id=3,
                name="accepted_invite",
                title_template="Invite Accepted!",
                message_template="{participant_username} accepted your invite to debate on {debate_title} and a live chat was created.",
                endnote_template="Go to chat"
            ),
        ])
