from django.test import Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from ProjectOpenDebate.common.base_tests import BaseTestCase
from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate
from debate.schemas import StanceDirectionEnum
from discussion.models import Discussion, Message, ReadCheckpoint, DiscussionRequest
from discussion.schemas import ArchiveStatusInputSchema
from discussion.services import DiscussionService

User = get_user_model()


class DiscussionApiTestBase(BaseTestCase):
    def setUp(self):
        # Create test users
        self.user1 = User.objects.create_user(username='testuser1', email='user1@example.com', password='password123')
        self.user2 = User.objects.create_user(username='testuser2', email='user2@example.com', password='password123')
        self.user3 = User.objects.create_user(username='testuser3', email='user3@example.com', password='password123')

        # Create test debates
        self.debate1 = Debate.objects.create(
            title="Test Debate 1",
            description="Description for test debate 1",
            author=self.user1
        )
        self.debate2 = Debate.objects.create(
            title="Test Debate 2",
            description="Description for test debate 2",
            author=self.user2
        )

        # Create test discussions
        self.discussion1 = Discussion.objects.create(
            debate=self.debate1,
            participant1=self.user1,
            participant2=self.user2
        )
        self.discussion1.create_read_checkpoints()

        self.discussion2 = Discussion.objects.create(
            debate=self.debate2,
            participant1=self.user2,
            participant2=self.user3
        )
        self.discussion2.create_read_checkpoints()

        # Create test messages
        self.message1_1 = Message.objects.create(
            discussion=self.discussion1,
            author=self.user1,
            text="Message 1 from user1 to user2"
        )
        self.message1_2 = Message.objects.create(
            discussion=self.discussion1,
            author=self.user2,
            text="Message 1 from user2 to user1"
        )
        self.message1_3 = Message.objects.create(
            discussion=self.discussion1,
            author=self.user1,
            text="Message 2 from user1 to user2"
        )

        self.message2_1 = Message.objects.create(
            discussion=self.discussion2,
            author=self.user2,
            text="Message 1 from user2 to user3"
        )

        self.message2_2 = Message.objects.create(
            discussion=self.discussion2,
            author=self.user3,
            text="Message 1 from user3 to user2"
        )

        # Create test client
        self.client = Client()

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


class DiscussionRequestTest(DiscussionApiTestBase):
    def test_stance_removes_discussion_requests(self):
        # Create a discussion request
        request = DiscussionRequest.objects.create(
            requester=self.user1,
            debate=self.debate1,
            stance_wanted=StanceDirectionEnum.FOR
        )

        # Import and set up the services we need to test
        from debate.services import StanceService

        # Set a stance (which should remove the request)
        StanceService.set_stance(self.user1, self.debate1.id, StanceDirectionEnum.FOR)

        # Verify discussion request was removed
        self.assertFalse(
            DiscussionRequest.objects.filter(
                requester=self.user1,
                debate=self.debate1
            ).exists()
        )


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
    def setUp(self):
        super().setUp()

        # Create additional messages for pagination testing
        for i in range(35):  # Create 35 additional messages
            Message.objects.create(
                discussion=self.discussion1,
                author=self.user1 if i % 2 == 0 else self.user2,
                text=f"Pagination test message {i}"
            )

    def test_message_pagination(self):
        client = self.authenticate_user1()

        # Test first page (default page size is 30)
        response = client.get(reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 30)

        # Test second page
        response = client.get(
            reverse_lazy_api("get_discussion_messages", discussion_id=self.discussion1.id),
            {"page": 2}
        )
        self.assertEqual(response.status_code, 200)
        # Should have 8 messages (35 + 3 original messages - 30 from first page)
        self.assertEqual(len(response.json()["items"]), 8)

    def test_discussions_pagination(self):
        # Create additional discussions for testing pagination
        user4 = User.objects.create_user(username='testuser4', email='user4@example.com', password='password123')

        for i in range(15):  # Create 15 additional discussions
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

        # Test pagination for user2 who should have 17 discussions (2 original + 15 new)
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_discussions"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 15)  # Default page size is 15

        # Test second page
        response = client.get(reverse_lazy_api("get_discussions"), {"page": 2})
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
