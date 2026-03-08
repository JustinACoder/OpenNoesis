from django.test import Client, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from unittest.mock import patch
import hashlib

from ProjectOpenDebate.common.base_tests import BaseTestCase
from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate
from debate.schemas import StanceDirectionEnum
from discussion.models import Discussion, Message, ReadCheckpoint, DiscussionAIConfig
from discussion.ai import ensure_ai_bot_user, generate_ai_reply_stream
from discussion.schemas import ArchiveStatusInputSchema
from discussion.services import DiscussionService
from discussion.tasks import generate_ai_reply_for_message
from pairing.models import PairingRequest

User = get_user_model()


class DiscussionApiTestBase(BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        # Create test users
        cls.user1 = User.objects.create_user(username='testuser1', email='user1@example.com', password='password123')
        cls.user2 = User.objects.create_user(username='testuser2', email='user2@example.com', password='password123')
        cls.user3 = User.objects.create_user(username='testuser3', email='user3@example.com', password='password123')

        # Create test debates
        cls.debate1 = Debate.objects.create(
            title="Test Debate 1",
            description="Description for test debate 1",
            author=cls.user1
        )
        cls.debate2 = Debate.objects.create(
            title="Test Debate 2",
            description="Description for test debate 2",
            author=cls.user2
        )

        # Create test discussions
        cls.discussion1 = Discussion.objects.create(
            debate=cls.debate1,
            participant1=cls.user1,
            participant2=cls.user2
        )
        cls.discussion1.create_read_checkpoints()

        cls.discussion2 = Discussion.objects.create(
            debate=cls.debate2,
            participant1=cls.user2,
            participant2=cls.user3
        )
        cls.discussion2.create_read_checkpoints()

        # Create test messages
        cls.message1_1 = Message.objects.create(
            discussion=cls.discussion1,
            author=cls.user1,
            text="Message 1 from user1 to user2"
        )
        cls.message1_2 = Message.objects.create(
            discussion=cls.discussion1,
            author=cls.user2,
            text="Message 1 from user2 to user1"
        )
        cls.message1_3 = Message.objects.create(
            discussion=cls.discussion1,
            author=cls.user1,
            text="Message 2 from user1 to user2"
        )

        cls.message2_1 = Message.objects.create(
            discussion=cls.discussion2,
            author=cls.user2,
            text="Message 1 from user2 to user3"
        )

        cls.message2_2 = Message.objects.create(
            discussion=cls.discussion2,
            author=cls.user3,
            text="Message 1 from user3 to user2"
        )

        # Create test client
        cls.client = Client()

    def authenticate_user1(self):
        client = Client()
        client.login(username='testuser1', password='password123')
        return client

    def authenticate_user2(self):
        client = Client()
        client.login(username='testuser2', password='password123')
        return client

    def authenticate_user3(self):
        client = Client()
        client.login(username='testuser3', password='password123')
        return client


class DiscussionListingEndpointsTest(DiscussionApiTestBase):
    def test_get_discussions_authenticated(self):
        # Test user1 can see their discussions
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussions"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["id"], self.discussion1.id)

        # Test user2 can see their discussions (should see both)
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_discussions"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 2)
        discussion_ids = [item["id"] for item in response.json()["items"]]
        self.assertIn(self.discussion1.id, discussion_ids)
        self.assertIn(self.discussion2.id, discussion_ids)

    def test_get_discussions_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_discussions"))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_filter_active_discussions(self):
        # Archive discussion1 for user1
        self.discussion1.is_archived_for_p1 = True
        self.discussion1.save()

        # User1 should see no active discussions
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussions"), {'filterType': 'active'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 0)

        # User2 should still see discussion1 as active
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_discussions"), {'filterType': 'active'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 2)

    def test_filter_archived_discussions(self):
        # Archive discussion1 for user1
        self.discussion1.is_archived_for_p1 = True
        self.discussion1.save()

        # User1 should see 1 archived discussion
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussions"), {'filterType': 'archived'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["id"], self.discussion1.id)

        # User2 should see no archived discussions
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_discussions"), {'filterType': 'archived'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 0)

    def test_get_most_recent_discussion(self):
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_most_recent_discussion"))
        self.assertEqual(response.status_code, 200)
        # Should return the most recently active discussion
        self.assertEqual(response.json()["id"], self.discussion2.id)

        # If no discussions exist, should return 404
        user4 = User.objects.create_user(username='testuser4', email='user4@example.com', password='password123')
        client = Client()
        client.login(username='testuser4', password='password123')
        response = client.get(reverse_lazy_api("get_most_recent_discussion"))
        self.assertEqual(response.status_code, 404)

    def test_get_most_recent_discussion_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_most_recent_discussion"))
        self.assertEqual(response.status_code, 401)  # Should require authentication


class AIDiscussionEndpointsTest(DiscussionApiTestBase):
    @override_settings(OPENAI_API_KEY="test-key")
    def test_start_ai_discussion_success(self):
        self.debate1.stance_set.create(user=self.user1, stance=1)
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("start_ai_discussion"),
            data={"debate_id": self.debate1.id, "desired_stance": -1},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        created_discussion_id = response.json()["id"]

        created_discussion = Discussion.objects.get(id=created_discussion_id)
        self.assertEqual(created_discussion.participant1_id, self.user1.id)
        self.assertTrue(DiscussionAIConfig.objects.filter(discussion=created_discussion).exists())

    @override_settings(OPENAI_API_KEY="test-key")
    def test_start_ai_discussion_requires_stance(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("start_ai_discussion"),
            data={"debate_id": self.debate1.id, "desired_stance": -1},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("set your stance", response.json()["detail"])

    def test_start_ai_discussion_unauthenticated(self):
        response = self.client.post(
            reverse_lazy_api("start_ai_discussion"),
            data={"debate_id": self.debate1.id, "desired_stance": -1},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    @override_settings(OPENAI_API_KEY="")
    def test_start_ai_discussion_returns_503_when_ai_unavailable(self):
        self.debate1.stance_set.create(user=self.user1, stance=1)
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("start_ai_discussion"),
            data={"debate_id": self.debate1.id, "desired_stance": -1},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(DiscussionAIConfig.objects.count(), 0)


class AIBotProvisioningTest(DiscussionApiTestBase):
    def test_ensure_ai_bot_user_normalizes_existing_account(self):
        existing, _ = User.objects.get_or_create(
            username=settings.AI_BOT_USERNAME,
            defaults={
                "email": "taken@example.com",
                "is_staff": True,
                "is_superuser": False,
                "is_active": True,
            },
        )
        existing.email = "taken@example.com"
        existing.is_staff = True
        existing.is_superuser = False
        existing.is_active = True
        existing.set_password("secret123")
        existing.save(update_fields=["email", "is_staff", "is_superuser", "is_active", "password"])
        self.assertTrue(existing.has_usable_password())

        ai_user = ensure_ai_bot_user()
        self.assertEqual(ai_user.id, existing.id)
        self.assertEqual(ai_user.email, settings.AI_BOT_EMAIL)
        self.assertFalse(ai_user.is_staff)
        self.assertFalse(ai_user.is_superuser)
        self.assertTrue(ai_user.is_active)
        self.assertFalse(ai_user.has_usable_password())


class AITaskBehaviorTest(DiscussionApiTestBase):
    def _create_ai_discussion_and_trigger(self, text: str) -> tuple[Discussion, User, Message]:
        ai_user = ensure_ai_bot_user()
        debate = Debate.objects.create(
            title="AI Task Debate",
            description="Verify AI task behavior",
            author=self.user1,
        )
        discussion = Discussion.objects.create(
            debate=debate,
            participant1=self.user1,
            participant2=ai_user,
        )
        discussion.create_read_checkpoints()
        DiscussionAIConfig.objects.create(
            discussion=discussion,
            bot_user=ai_user,
            ai_stance=-1,
            model=settings.OPENAI_MODEL,
        )
        trigger_message = Message.objects.create(
            discussion=discussion,
            author=self.user1,
            text=text,
        )
        return discussion, ai_user, trigger_message

    @patch("discussion.tasks.generate_ai_reply_stream")
    @patch("discussion.tasks._broadcast_ai_thinking")
    @patch("discussion.tasks._broadcast_ai_chunk")
    def test_ai_task_uses_trigger_message_text(
        self,
        _mock_chunk,
        _mock_thinking,
        mock_generate,
    ):
        discussion, ai_user, trigger_message = self._create_ai_discussion_and_trigger("first user message")
        mock_generate.return_value = (None, None)

        result = generate_ai_reply_for_message.run(trigger_message.id)

        self.assertEqual(result, "advanced_no_ai_reply_text=1")
        self.assertEqual(Message.objects.filter(discussion=discussion, author=ai_user).count(), 0)
        mock_generate.assert_called_once()
        self.assertEqual(
            mock_generate.call_args.kwargs["trigger_user_message"],
            "first user message",
        )
        config = DiscussionAIConfig.objects.get(discussion=discussion)
        self.assertEqual(config.last_trigger_message_id, trigger_message.id)

    @patch("discussion.tasks.generate_ai_reply_stream")
    @patch("discussion.tasks._broadcast_ai_thinking")
    @patch("discussion.tasks._broadcast_ai_chunk")
    def test_ai_task_clears_thinking_on_generation_exception(
        self,
        _mock_chunk,
        mock_thinking,
        mock_generate,
    ):
        _discussion, _ai_user, trigger_message = self._create_ai_discussion_and_trigger("boom")
        mock_generate.side_effect = RuntimeError("forced failure")

        with self.assertRaises(RuntimeError):
            generate_ai_reply_for_message.run(trigger_message.id)

        self.assertGreaterEqual(mock_thinking.call_count, 2)
        self.assertTrue(mock_thinking.call_args_list[0].args[2])
        self.assertFalse(mock_thinking.call_args_list[-1].args[2])

    @patch("discussion.tasks.generate_ai_reply_stream")
    @patch("discussion.tasks._broadcast_ai_thinking")
    @patch("discussion.tasks._broadcast_ai_chunk")
    def test_ai_task_processes_pending_messages_sequentially_even_if_trigger_is_newest(
        self,
        _mock_chunk,
        _mock_thinking,
        mock_generate,
    ):
        discussion, ai_user, first_message = self._create_ai_discussion_and_trigger("first")
        second_message = Message.objects.create(
            discussion=discussion,
            author=self.user1,
            text="second",
        )

        def _mock_reply(ai_config, trigger_user_message, on_delta=None):
            return (f"reply:{trigger_user_message}", f"resp:{trigger_user_message}")

        mock_generate.side_effect = _mock_reply

        # Simulate out-of-order processing where the newer trigger executes first.
        result = generate_ai_reply_for_message.run(second_message.id)
        self.assertIn("sent_ai_messages=2", result)

        ai_messages = list(
            Message.objects.filter(discussion=discussion, author=ai_user).order_by("id")
        )
        self.assertEqual(len(ai_messages), 2)
        self.assertEqual([m.text for m in ai_messages], ["reply:first", "reply:second"])

        # Running the older trigger afterwards should find nothing pending.
        second_result = generate_ai_reply_for_message.run(first_message.id)
        self.assertEqual(second_result, "skipped_no_pending_user_message")

    @patch("discussion.tasks.generate_ai_reply_stream")
    @patch("discussion.tasks._broadcast_ai_thinking")
    @patch("discussion.tasks._broadcast_ai_chunk")
    def test_ai_task_advances_cursor_on_empty_reply_and_continues(
        self,
        _mock_chunk,
        _mock_thinking,
        mock_generate,
    ):
        discussion, ai_user, first_message = self._create_ai_discussion_and_trigger("first")
        second_message = Message.objects.create(
            discussion=discussion,
            author=self.user1,
            text="second",
        )

        def _mock_reply(ai_config, trigger_user_message, on_delta=None):
            if trigger_user_message == "first":
                return (None, "resp:first")
            return ("reply:second", "resp:second")

        mock_generate.side_effect = _mock_reply

        result = generate_ai_reply_for_message.run(second_message.id)
        self.assertIn("sent_ai_messages=1", result)
        self.assertIn("skipped_no_ai_reply_text=1", result)

        ai_messages = list(
            Message.objects.filter(discussion=discussion, author=ai_user).order_by("id")
        )
        self.assertEqual(len(ai_messages), 1)
        self.assertEqual(ai_messages[0].text, "reply:second")

        config = DiscussionAIConfig.objects.get(discussion=discussion)
        self.assertEqual(config.last_trigger_message_id, second_message.id)
        self.assertEqual(config.last_openai_response_id, "resp:second")


class AIClientRequestTest(DiscussionApiTestBase):
    @override_settings(OPENAI_API_KEY="test-key")
    @patch("discussion.ai._build_system_prompt", return_value="prompt")
    @patch("discussion.ai.OpenAI")
    def test_generate_ai_reply_stream_sends_hashed_safety_identifier(
        self,
        mock_openai,
        _mock_prompt,
    ):
        ai_user = ensure_ai_bot_user()
        debate = Debate.objects.create(
            title="AI Safety Debate",
            description="Check safety identifier",
            author=self.user1,
        )
        discussion = Discussion.objects.create(
            debate=debate,
            participant1=self.user1,
            participant2=ai_user,
        )
        ai_config = DiscussionAIConfig.objects.create(
            discussion=discussion,
            bot_user=ai_user,
            ai_stance=-1,
            model=settings.OPENAI_MODEL,
        )

        mock_client = mock_openai.return_value
        mock_stream = mock_client.responses.stream.return_value.__enter__.return_value
        mock_stream.__iter__.return_value = iter([])
        mock_final_response = type("FinalResponse", (), {"output_text": "ok", "id": "resp_1"})()
        mock_stream.get_final_response.return_value = mock_final_response

        response_text, response_id = generate_ai_reply_stream(ai_config, "hello")

        self.assertEqual(response_text, "ok")
        self.assertEqual(response_id, "resp_1")
        expected_identifier = hashlib.sha256(
            f"opennoesis-user:{self.user1.id}".encode("utf-8")
        ).hexdigest()
        self.assertEqual(
            mock_client.responses.stream.call_args.kwargs["safety_identifier"],
            expected_identifier,
        )


class DiscussionDetailEndpointsTest(DiscussionApiTestBase):
    def test_get_discussion_detail(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussion", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.discussion1.id)
        self.assertEqual(response.json()["participant1"]["id"], self.user1.id)
        self.assertEqual(response.json()["participant2"]["id"], self.user2.id)

    def test_get_discussion_not_participant(self):
        # User1 should not be able to access discussion2
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussion", discussion_id=self.discussion2.id))
        self.assertEqual(response.status_code, 404)

    def test_get_discussion_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_discussion", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_get_nonexistent_discussion(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussion", discussion_id=999999))  # Non-existent ID
        self.assertEqual(response.status_code, 404)


class MessageEndpointsTest(DiscussionApiTestBase):
    def test_get_discussion_messages(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 3)

        # Check that messages are sorted by created_at in descending order
        message_ids = [item["id"] for item in response.json()["items"]]
        self.assertEqual(message_ids, [self.message1_3.id, self.message1_2.id, self.message1_1.id])

    def test_get_discussion_messages_not_participant(self):
        client = self.authenticate_user3()
        response = client.get(reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 404)

    def test_get_discussion_messages_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 401)  # Should require authentication


class ArchiveEndpointsTest(DiscussionApiTestBase):
    def test_set_archive_status(self):
        client = self.authenticate_user1()

        # Archive discussion
        archive_data = ArchiveStatusInputSchema(status=True).dict()
        response = client.patch(
            reverse_lazy_api("set_discussion_archive_status", discussion_id=self.discussion1.id),
            data=archive_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify archived status is set
        self.discussion1.refresh_from_db()
        self.assertTrue(self.discussion1.is_archived_for_p1)
        self.assertFalse(self.discussion1.is_archived_for_p2)

        # Unarchive discussion
        archive_data = ArchiveStatusInputSchema(status=False).dict()
        response = client.patch(
            reverse_lazy_api("set_discussion_archive_status", discussion_id=self.discussion1.id),
            data=archive_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify archived status is unset
        self.discussion1.refresh_from_db()
        self.assertFalse(self.discussion1.is_archived_for_p1)
        self.assertFalse(self.discussion1.is_archived_for_p2)

    def test_set_archive_status_not_participant(self):
        client = self.authenticate_user3()
        archive_data = ArchiveStatusInputSchema(status=True).dict()
        response = client.patch(
            reverse_lazy_api("set_discussion_archive_status", discussion_id=self.discussion1.id),
            data=archive_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)  # Should not find the discussion

    def test_set_archive_status_unauthenticated(self):
        archive_data = ArchiveStatusInputSchema(status=True).dict()
        response = self.client.patch(
            reverse_lazy_api("set_discussion_archive_status", discussion_id=self.discussion1.id),
            data=archive_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication


class ReadCheckpointEndpointsTest(DiscussionApiTestBase):
    def test_get_read_checkpoints(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_read_checkpoints", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)  # Should have 2 checkpoints (one for each participant)

    def test_get_read_checkpoints_not_participant(self):
        client = self.authenticate_user3()
        response = client.get(reverse_lazy_api("get_read_checkpoints", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 404)

    def test_get_read_checkpoints_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_read_checkpoints", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 401)  # Should require authentication


class UnreadCountEndpointsTest(DiscussionApiTestBase):
    def test_get_unread_count(self):
        # Set up read checkpoint for user2 to mark as read
        user2_checkpoint = ReadCheckpoint.objects.get(discussion=self.discussion1, user=self.user2)
        user2_checkpoint.read_until(self.message1_2)  # Read up to their own message

        ## Discussion 1
        # At this point message1_1 and message1_2 should be read
        # message1_3 should be unread
        ## Discussion 2
        # message2_1 should be unread (its own message)
        # message2_2 should be unread (user3's message)
        # So total unread messages should be 3 (message1_3, message2_1, message2_2)

        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_messages_unread_count"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), 3)

    def test_get_unread_count_for_discussion(self):
        # Set up read checkpoint for user2
        user2_checkpoint = ReadCheckpoint.objects.get(discussion=self.discussion1, user=self.user2)
        user2_checkpoint.read_until(self.message1_2)  # Read up to their own message

        client = self.authenticate_user2()
        response = client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=self.discussion1.id)
        )
        self.assertEqual(response.status_code, 200)
        # Should have 1 unread message (message1_3)
        self.assertEqual(response.json(), 1)

    def test_get_unread_count_not_participant(self):
        client = self.authenticate_user3()
        response = client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=self.discussion1.id)
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), 0)  # Should have 0 unread messages since user3 is not a participant

    def test_get_unread_count_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_messages_unread_count"))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_get_unread_count_for_discussion_unauthenticated(self):
        response = self.client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=self.discussion1.id)
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication


class DiscussionCreationTest(DiscussionApiTestBase):
    def test_create_discussion_and_readcheckpoints(self):
        # Create a new debate for testing
        debate3 = Debate.objects.create(
            title="Test Debate 3",
            description="Description for test debate 3",
            author=self.user3
        )

        # Create a discussion using the service
        discussion = DiscussionService.create_discussion_and_readcheckpoints(
            debate=debate3,
            participant1=self.user1,
            participant2=self.user3
        )

        # Verify discussion was created correctly
        self.assertEqual(discussion.debate, debate3)
        self.assertEqual(discussion.participant1, self.user1)
        self.assertEqual(discussion.participant2, self.user3)

        # Verify readcheckpoints were created
        self.assertEqual(ReadCheckpoint.objects.filter(discussion=discussion).count(), 2)
        self.assertTrue(ReadCheckpoint.objects.filter(discussion=discussion, user=self.user1).exists())
        self.assertTrue(ReadCheckpoint.objects.filter(discussion=discussion, user=self.user3).exists())

    def test_create_discussion_with_ids(self):
        # Create a new debate for testing
        debate3 = Debate.objects.create(
            title="Test Debate 3",
            description="Description for test debate 3",
            author=self.user3
        )

        # Create a discussion using IDs instead of objects
        discussion = DiscussionService.create_discussion_and_readcheckpoints(
            debate=debate3.id,
            participant1=self.user1.id,
            participant2=self.user3.id
        )

        # Verify discussion was created correctly
        self.assertEqual(discussion.debate.id, debate3.id)
        self.assertEqual(discussion.participant1.id, self.user1.id)
        self.assertEqual(discussion.participant2.id, self.user3.id)


class PaginationTest(DiscussionApiTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        # Create additional messages for pagination testing
        for i in range(35):  # Create 35 additional messages
            Message.objects.create(
                discussion=cls.discussion1,
                author=cls.user1 if i % 2 == 0 else cls.user2,
                text=f"Pagination test message {i}"
            )

    def test_message_pagination(self):
        client = self.authenticate_user1()

        # Test first page (default page size is 20)
        response = client.get(reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 20)

        # Test second page
        cursor = response.json().get("next_cursor")
        response = client.get(
            reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id),
            {"cursor": cursor}
        )
        self.assertEqual(response.status_code, 200)
        # Should have 18 messages (35 + 3 original messages - 20 from first page)
        self.assertEqual(len(response.json()["items"]), 18)

    def test_discussions_pagination(self):
        # Create additional discussions for testing pagination
        user4 = User.objects.create_user(username='testuser4', email='user4@example.com', password='password123')

        for i in range(20):  # Create 20 additional discussions
            discussion = Discussion.objects.create(
                debate=self.debate1,
                participant1=self.user2,
                participant2=user4
            )
            discussion.create_read_checkpoints()

            # Add a message to each discussion
            Message.objects.create(
                discussion=discussion,
                author=self.user2,
                text=f"Test message for pagination discussion {i}"
            )

        # Test pagination for user2 who should have 22 discussions (2 original + 20 new)
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_discussions"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 20)  # Default page size is 20

        # Test second page
        cursor = response.json().get("next_cursor")
        response = client.get(reverse_lazy_api("get_discussions"), {"cursor": cursor})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 2)  # Should have 2 discussions on second page


class ReadCheckpointDetailTest(DiscussionApiTestBase):
    def test_read_messages_functionality(self):
        # Get user1's checkpoint
        checkpoint = ReadCheckpoint.objects.get(discussion=self.discussion1, user=self.user1)

        # Initially no messages should be marked as read
        self.assertIsNone(checkpoint.last_message_read)
        self.assertIsNone(checkpoint.read_at)

        # Mark messages as read
        num_read = checkpoint.read_messages()

        # Should have read 3 messages
        self.assertEqual(num_read, 3)

        # Checkpoint should now point to the latest message
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.last_message_read.id, self.message1_3.id)
        self.assertIsNotNone(checkpoint.read_at)

        # Reading again should return 0 as all messages are already read
        num_read = checkpoint.read_messages()
        self.assertEqual(num_read, 0)

    def test_read_until_specific_message(self):
        # Get user2's checkpoint
        checkpoint = ReadCheckpoint.objects.get(discussion=self.discussion1, user=self.user2)

        # Read until the second message
        checkpoint.read_until(self.message1_2)

        # Verify checkpoint was updated
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.last_message_read.id, self.message1_2.id)

        # Check unread count
        client = self.authenticate_user2()
        response = client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=self.discussion1.id)
        )
        self.assertEqual(response.status_code, 200)
        # Should have 1 unread message (message1_3)
        self.assertEqual(response.json(), 1)


class UnreadCountEdgeCasesTest(DiscussionApiTestBase):
    def test_unread_count_with_no_messages(self):
        # Create a new discussion with no messages
        discussion = Discussion.objects.create(
            debate=self.debate1,
            participant1=self.user1,
            participant2=self.user3
        )
        discussion.create_read_checkpoints()

        # Check unread count
        client = self.authenticate_user1()
        response = client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=discussion.id)
        )
        self.assertEqual(response.status_code, 200)
        # Should have 0 unread messages
        self.assertEqual(response.json(), 0)

    def test_unread_count_with_read_checkpoint_but_no_messages_read(self):
        # Get user1's checkpoint but don't mark any messages as read
        checkpoint = ReadCheckpoint.objects.get(discussion=self.discussion1, user=self.user1)
        # Set read_at without setting last_message_read (user opened discussion but didn't read any messages)
        checkpoint.read_at = timezone.now()
        checkpoint.save()

        # Check unread count
        client = self.authenticate_user1()
        response = client.get(
            reverse_lazy_api("get_unread_count_for_discussion", discussion_id=self.discussion1.id)
        )
        self.assertEqual(response.status_code, 200)
        # Should have 3 unread messages
        self.assertEqual(response.json(), 3)

    def test_unread_count_with_archived_discussions(self):
        # Archive discussion1 for user1
        self.discussion1.is_archived_for_p1 = True
        self.discussion1.save()

        # Check global unread count for user1
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_messages_unread_count"))
        self.assertEqual(response.status_code, 200)
        # Should have 0 unread messages since the discussion is archived
        self.assertEqual(response.json(), 0)
