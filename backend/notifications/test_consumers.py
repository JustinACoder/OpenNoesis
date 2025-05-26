import asyncio
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from ProjectOpenDebate.common.base_tests import BaseTransactionTestCase
from notifications.models import Notification, NotificationType

User = get_user_model()


class NotificationConsumerTestBase(BaseTransactionTestCase):
    STREAM_NAME = "notification"

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
        
        # Ensure notification types exist
        self.notification_type = NotificationType.objects.get(name='new_message')
        
        # Create test notifications for user1
        self.notification1 = Notification.objects.create(
            user=self.user1,
            notification_type=self.notification_type,
            data={"participant_username": "testuser2", "debate_title": "Test Debate"},
            info_args={"discussion_id": 1},
            read=False
        )
        
        self.notification2 = Notification.objects.create(
            user=self.user1,
            notification_type=self.notification_type,
            data={"participant_username": "testuser2", "debate_title": "Another Test Debate"},
            info_args={"discussion_id": 2},
            read=True
        )
        
        # Create a notification for user2
        self.notification3 = Notification.objects.create(
            user=self.user2,
            notification_type=self.notification_type,
            data={"participant_username": "testuser1", "debate_title": "User2's Debate"},
            info_args={"discussion_id": 3},
            read=False
        )


class NotificationConsumerReadTests(NotificationConsumerTestBase):
    async def test_set_notification_as_read(self):
        """Test marking a notification as read successfully"""
        await self.setUpAsync()
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send request to mark notification as read
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": self.notification1.id,
                "is_read": True
            }
        })
        
        # User should receive confirmation
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "set_read")
        self.assertEqual(response["data"]["notification_id"], self.notification1.id)
        self.assertEqual(response["data"]["is_read"], True)
        
        # Verify database updated
        updated_notification = await database_sync_to_async(Notification.objects.get)(id=self.notification1.id)
        self.assertTrue(updated_notification.read)
        
        await communicator.disconnect()
    
    async def test_set_notification_as_unread(self):
        """Test marking a notification as unread"""
        await self.setUpAsync()
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send request to mark notification as unread
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": self.notification2.id,
                "is_read": False
            }
        })
        
        # User should receive confirmation
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "set_read")
        self.assertEqual(response["data"]["notification_id"], self.notification2.id)
        self.assertEqual(response["data"]["is_read"], False)
        
        # Verify database updated
        updated_notification = await database_sync_to_async(Notification.objects.get)(id=self.notification2.id)
        self.assertFalse(updated_notification.read)
        
        await communicator.disconnect()


class NotificationConsumerErrorHandlingTests(NotificationConsumerTestBase):
    async def test_nonexistent_notification(self):
        """Test setting read status on a non-existent notification"""
        await self.setUpAsync()
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send request with non-existent ID
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": 99999,  # Non-existent ID
                "is_read": True
            }
        })
        
        # Should get an error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Notification not found", response["message"])
        
        await communicator.disconnect()
    
    async def test_notification_belonging_to_another_user(self):
        """Test setting read status on another user's notification"""
        await self.setUpAsync()
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Try to mark user2's notification as read
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": self.notification3.id,  # Belongs to user2
                "is_read": True
            }
        })
        
        # Should get an error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Notification not found", response["message"])
        
        # Verify notification was not changed
        updated_notification = await database_sync_to_async(Notification.objects.get)(id=self.notification3.id)
        self.assertFalse(updated_notification.read)
        
        await communicator.disconnect()
    
    async def test_invalid_payload_missing_fields(self):
        """Test with invalid payload missing required fields"""
        await self.setUpAsync()
        
        communicator = await self.connect_client(self.user1)
        
        # Send payload missing is_read field
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": self.notification1.id,
                # Missing is_read field
            }
        })
        
        # Should get validation error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid payload", response["message"])
        
        await communicator.disconnect()
    
    async def test_invalid_payload_wrong_types(self):
        """Test with invalid payload with wrong data types"""
        await self.setUpAsync()
        
        communicator = await self.connect_client(self.user1)
        
        # Send payload with wrong types
        await communicator.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": "not-an-integer",  # Should be int
                "is_read": "not-a-boolean"  # Should be bool
            }
        })
        
        # Should get validation error
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid payload", response["message"])
        
        await communicator.disconnect()
    
    async def test_invalid_event_type(self):
        """Test sending an invalid event type"""
        await self.setUpAsync()
        
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


class NotificationConsumerIntegrationTests(NotificationConsumerTestBase):
    @patch('notifications.models.get_channel_layer')
    async def test_notification_update_propagation(self, mock_channel_layer):
        """Test that the notification update is propagated correctly"""
        await self.setUpAsync()
        
        # Setup mocked channel layer
        mock_group_send = MagicMock(return_value=asyncio.Future())
        mock_group_send.return_value.set_result(None)  # Complete the future
        mock_channel_layer.return_value.group_send = mock_group_send
        
        # Connect both users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)
        
        # User1 marks notification as read
        await communicator1.send_json_to({
            "event_type": "set_read",
            "data": {
                "notification_id": self.notification1.id,
                "is_read": True
            }
        })
        
        # User1 should receive confirmation
        response = await communicator1.receive_json_from()
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "set_read")
        
        # User2 should not receive any message from user1's action
        with self.assertRaises(asyncio.TimeoutError):
            await asyncio.wait_for(communicator2.receive_json_from(), timeout=0.5)
        
        await communicator1.disconnect()
        await communicator2.disconnect()

    @patch('notifications.models.get_channel_layer')
    async def test_new_notification_send_by_ws(self, mock_channel_layer):
        """Test that new notifications are automatically sent to the user"""
        await self.setUpAsync()
        
        # Setup mocked channel layer to track calls
        mock_group_send = MagicMock(return_value=asyncio.Future())
        mock_group_send.return_value.set_result(None)  # Complete the future
        mock_channel_layer.return_value.group_send = mock_group_send
        
        # Create a new notification programmatically 
        new_notification = await database_sync_to_async(Notification.objects.create_notification)(
            user=self.user1,
            notification_type_name='new_message',
            data={"participant_username": "testuser2", "debate_title": "New Test Debate"},
            info_args={"discussion_id": 4}
        )

        # Verify that the channel layer was called with the expected parameters
        self.assertTrue(mock_group_send.called)
        # Get the call arguments
        call_args = mock_group_send.call_args[0]
        
        # First argument should be the group name for user1
        self.assertIn(str(self.user1.id), call_args[0])
        
        # Second argument should be a dict with notification data
        message_data = call_args[1]
        self.assertEqual(message_data['event_type'], 'new_notification')
        self.assertEqual(message_data['status'], 'success')
        self.assertEqual(message_data['data']['id'], new_notification.id)
