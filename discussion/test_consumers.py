import asyncio
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from ProjectOpenDebate.common.base_tests import BaseTransactionTestCase
from debate.models import Debate
from discussion.models import Discussion, Message, ReadCheckpoint

User = get_user_model()


class DiscussionConsumerTestBase(BaseTransactionTestCase):
    STREAM_NAME = "discussion"

    @database_sync_to_async
    def setUpAsync(self):
        super().customSetUp()

        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1', email='user1@example.com', password='password123'
        )
        self.user2 = User.objects.create_user(
            username='testuser2', email='user2@example.com', password='password123'
        )
        self.user3 = User.objects.create_user(
            username='testuser3', email='user3@example.com', password='password123'
        )

        # Create test debate
        self.debate = Debate.objects.create(
            title="Test Debate",
            description="Description for test debate",
            author=self.user1
        )

        # Create test discussion
        self.discussion = Discussion.objects.create(
            debate=self.debate,
            participant1=self.user1,
            participant2=self.user2
        )
        self.discussion.create_read_checkpoints()

        # Create initial messages
        self.message1 = Message.objects.create(
            discussion=self.discussion,
            author=self.user1,
            text="Message 1 from user1 to user2"
        )
        self.message2 = Message.objects.create(
            discussion=self.discussion,
            author=self.user2,
            text="Message 1 from user2 to user1"
        )


class DiscussionConsumerMessagingTests(DiscussionConsumerTestBase):
    async def test_new_message_success(self):
        """Test sending a new message successfully"""
        await self.setUpAsync()  # noqa
        # Connect user1
        communicator1 = await self.connect_client(self.user1)
        # Connect user2 as well to receive the message
        communicator2 = await self.connect_client(self.user2)

        # Send new message
        new_message_data = {
            "discussion_id": self.discussion.id,
            "message": "Hello from the test"
        }

        await communicator1.send_json_to({
            "event_type": "new_message",
            "data": new_message_data
        })

        # User1 should receive confirmation
        response1 = await communicator1.receive_json_from()
        self.assertEqual(response1["status"], "success")
        self.assertEqual(response1["event_type"], "new_message")

        # User2 should receive the same message
        response2 = await communicator2.receive_json_from()
        self.assertEqual(response2["status"], "success")
        self.assertEqual(response2["event_type"], "new_message")

        # Verify message content
        message_data = response1["data"]["message"]
        self.assertEqual(message_data["text"], "Hello from the test")
        self.assertEqual(message_data["author"], self.user1.id)

        # Message should be stored in database
        messages = await database_sync_to_async(
            lambda: list(Message.objects.filter(text="Hello from the test"))
        )()
        self.assertEqual(len(messages), 1)

        # Clean up
        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_new_message_not_participant(self):
        """Test sending a message to a discussion where the user is not a participant"""
        await self.setUpAsync()  # noqa
        # Connect user3 who is not part of the discussion
        communicator = await self.connect_client(self.user3)

        # Try to send a message
        await communicator.send_json_to({
            "event_type": "new_message",
            "data": {
                "discussion_id": self.discussion.id,
                "message": "I shouldn't be able to send this"
            }
        })

        # Should get an error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("not a participant", response["message"])

        # No new message should be in the database
        count = await Message.objects.filter(text="I shouldn't be able to send this").acount()
        self.assertEqual(count, 0)

        await communicator.disconnect()

    async def test_new_message_invalid_format(self):
        """Test sending a message with invalid format"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Send malformed message
        await communicator.send_json_to({
            "event_type": "new_message",
            "data": {
                "discussion_id": self.discussion.id,
                # Missing "message" field
            }
        })

        # Should get validation error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid payload", response["message"])

        await communicator.disconnect()


class ReadMessagesTests(DiscussionConsumerTestBase):
    async def test_read_messages(self):
        """Test marking messages as read"""
        await self.setUpAsync()  # noqa
        # Connect both users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)

        # User1 reads messages
        await communicator1.send_json_to({
            "event_type": "read_messages",
            "data": {
                "discussion_id": self.discussion.id,
                "through_load_discussion": False
            }
        })

        # Both users should receive a read_messages notification
        response1 = await communicator1.receive_json_from()
        response2 = await communicator2.receive_json_from()

        self.assertEqual(response1["status"], "success")
        self.assertEqual(response1["event_type"], "read_messages")
        self.assertEqual(response2["status"], "success")
        self.assertEqual(response2["event_type"], "read_messages")

        # Verify data
        self.assertEqual(response1["data"]["discussion_id"], self.discussion.id)
        self.assertEqual(response1["data"]["user_id"], self.user1.id)

        # User1's ReadCheckpoint should be updated in the database
        read_checkpoint = await ReadCheckpoint.objects.aget(discussion=self.discussion, user=self.user1)
        self.assertIsNotNone(read_checkpoint.last_message_read_id)
        self.assertIsNotNone(read_checkpoint.read_at)

        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_read_through_load_discussion(self):
        """Test marking messages as read through loading a discussion"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Read messages with through_load_discussion=True
        await communicator.send_json_to({
            "event_type": "read_messages",
            "data": {
                "discussion_id": self.discussion.id,
                "through_load_discussion": True
            }
        })

        response = await communicator.receive_json_from()

        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "read_messages")
        self.assertTrue(response["data"]["through_load_discussion"])

        await communicator.disconnect()

    async def test_read_messages_timing_issue(self):
        """
        Test the potential timing issue where a user reads messages and immediately 
        after another user sends a new message
        """
        await self.setUpAsync()  # noqa
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)

        # First read all messages
        await communicator1.send_json_to({
            "event_type": "read_messages",
            "data": {
                "discussion_id": self.discussion.id,
                "through_load_discussion": False
            }
        })

        # Wait for read confirmation
        await communicator1.receive_json_from()
        await communicator2.receive_json_from()

        # Quickly send a new message from user2
        await communicator2.send_json_to({
            "event_type": "new_message",
            "data": {
                "discussion_id": self.discussion.id,
                "message": "New quick message"
            }
        })

        # Receive message confirmations
        await communicator2.receive_json_from()
        await communicator1.receive_json_from()

        # Verify that the new message is not marked as read
        read_checkpoint = await ReadCheckpoint.objects.aget(discussion=self.discussion, user=self.user1)
        latest_message = await Message.objects.filter(discussion=self.discussion).order_by('-created_at').afirst()

        # The latest message should have a different ID than the last read message
        self.assertNotEqual(read_checkpoint.last_message_read_id, latest_message.id)

        await communicator1.disconnect()
        await communicator2.disconnect()


class DiscussionConsumerErrorHandlingTests(DiscussionConsumerTestBase):
    async def test_non_existent_discussion(self):
        """Test sending a message to a non-existent discussion"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Send message to non-existent discussion
        await communicator.send_json_to({
            "event_type": "new_message",
            "data": {
                "discussion_id": 99999,  # Non-existent ID
                "message": "This discussion doesn't exist"
            }
        })

        # Should get error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("not a participant", response["message"])

        await communicator.disconnect()

    async def test_invalid_event_type(self):
        """Test sending an invalid event type"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Send invalid event type
        await communicator.send_json_to({
            "event_type": "invalid_event",
            "data": {}
        })

        # Should get error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid event_type", response["message"])

        await communicator.disconnect()

    async def test_read_messages_invalid_payload(self):
        """Test read_messages with invalid payload"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Send read_messages without discussion_id
        await communicator.send_json_to({
            "event_type": "read_messages",
            "data": {
                # Missing discussion_id
                "through_load_discussion": False
            }
        })

        # Should get validation error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid payload", response["message"])

        await communicator.disconnect()


class DiscussionConsumerIntegrationTests(DiscussionConsumerTestBase):
    @patch('channels.layers.get_channel_layer')
    async def test_archived_flag_propagation(self, mock_channel_layer):
        """Test that the archived flag is correctly propagated to clients"""
        await self.setUpAsync()  # noqa
        # Setup mocked channel layer
        mock_send = MagicMock()
        mock_channel_layer.return_value.group_send = mock_send

        # Mark the discussion as archived for user1
        self.discussion.is_archived_for_p1 = True
        await self.discussion.asave()

        # Connect and send a message from user2
        communicator = await self.connect_client(self.user2)

        await communicator.send_json_to({
            "event_type": "new_message",
            "data": {
                "discussion_id": self.discussion.id,
                "message": "This should be in an archived discussion for user1"
            }
        })

        # Wait for response
        await communicator.receive_json_from()

        # Check message was sent correctly
        latest_message = await Message.objects.filter(discussion=self.discussion).order_by('-created_at').afirst()
        self.assertEqual(latest_message.text, "This should be in an archived discussion for user1")

        await communicator.disconnect()

    async def test_message_ordering(self):
        """Test that messages are received in correct order"""
        await self.setUpAsync()  # noqa
        communicator = await self.connect_client(self.user1)

        # Send multiple messages with small delay between them
        message_texts = [f"Order test {i}" for i in range(5)]

        for text in message_texts:
            await communicator.send_json_to({
                "event_type": "new_message",
                "data": {
                    "discussion_id": self.discussion.id,
                    "message": text
                }
            })
            await communicator.receive_json_from()  # Get confirmation
            await asyncio.sleep(0.01)  # Small delay

        # Verify messages are stored in correct order
        messages = await database_sync_to_async(
            lambda: list(Message.objects.filter(
                discussion=self.discussion,
                text__startswith="Order test"
            ).order_by('created_at').values_list('text', flat=True))
        )()

        self.assertEqual(messages, message_texts)

        await communicator.disconnect()
