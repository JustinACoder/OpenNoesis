from django.test import Client
from django.contrib.auth import get_user_model

from ProjectOpenDebate.common.base_tests import BaseTestCase
from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate
from debateme.services import InviteService
from discussion.models import Discussion, Message
from notifications.models import Notification, NotificationType
from notifications.services import NotificationService

User = get_user_model()


class NotificationApiTestBase(BaseTestCase):
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
        
        # Create test discussions
        cls.discussion1 = Discussion.objects.create(
            debate=cls.debate1,
            participant1=cls.user1,
            participant2=cls.user2
        )
        
        # Notifications types are already created in BaseTestCase
        cls.new_message_type = NotificationType.objects.get(name='new_message')
        cls.new_discussion_type = NotificationType.objects.get(name='new_discussion')
        cls.accepted_invite_type = NotificationType.objects.get(name='accepted_invite')
        
        # Create test notifications
        cls.notification1 = Notification.objects.create(
            user=cls.user1,
            notification_type=cls.new_message_type,
            data={
                'debate_title': cls.debate1.title,
                'participant_username': cls.user2.username
            },
            info_args={'discussion_id': cls.discussion1.id}
        )
        
        cls.notification2 = Notification.objects.create(
            user=cls.user1,
            notification_type=cls.new_message_type,
            data={
                'debate_title': cls.debate1.title,
                'participant_username': cls.user3.username
            },
            info_args={'discussion_id': cls.discussion1.id},
            read=True  # This notification is already read
        )
        
        cls.notification3 = Notification.objects.create(
            user=cls.user2,
            notification_type=cls.new_message_type,
            data={
                'debate_title': cls.debate1.title,
                'participant_username': cls.user1.username
            },
            info_args={'discussion_id': cls.discussion1.id}
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


class NotificationListingEndpointsTest(NotificationApiTestBase):
    def test_get_notifications_authenticated(self):
        # Test user1 can see their notifications
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_notifications"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        # User1 should see 2 notifications (notification1 and notification2)
        self.assertEqual(len(response.json()["items"]), 2)
        notification_ids = [item["id"] for item in response.json()["items"]]
        self.assertIn(self.notification1.id, notification_ids)
        self.assertIn(self.notification2.id, notification_ids)

        # Test user2 can see their notifications
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_notifications"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        # User2 should see 1 notification (notification3)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["id"], self.notification3.id)

    def test_get_notifications_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_notifications"))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_filter_unread_notifications(self):
        # User1 has one unread notification (notification1)
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_notifications"), {'only_unread': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["id"], self.notification1.id)

    def test_get_unread_count(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_notifications_unread_count"))
        self.assertEqual(response.status_code, 200)
        # User1 should have 1 unread notification (notification1)
        self.assertEqual(response.json(), 1)
        
        # User2 should have 1 unread notification (notification3)
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_notifications_unread_count"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), 1)
        
        # User3 should have 0 unread notifications
        client = self.authenticate_user3()
        response = client.get(reverse_lazy_api("get_notifications_unread_count"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), 0)

    def test_get_unread_count_unauthenticated(self):
        response = self.client.get(reverse_lazy_api("get_notifications_unread_count"))
        self.assertEqual(response.status_code, 401)  # Should require authentication


class NotificationReadStatusEndpointsTest(NotificationApiTestBase):
    def test_set_notification_read_status(self):
        client = self.authenticate_user1()
        
        # Mark notification1 as read
        response = client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=self.notification1.id),
            {"read_status": "true"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 204)
        
        # Verify notification was marked as read
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.read)
        
        # Mark notification1 as unread
        response = client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=self.notification1.id),
            {"read_status": "false"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 204)
        
        # Verify notification was marked as unread
        self.notification1.refresh_from_db()
        self.assertFalse(self.notification1.read)
        
        # Attempt to mark notification2 as unread (which is already read)
        response = client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=self.notification2.id),
            {"read_status": "false"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 204)
        
        # Verify notification2 is now unread
        self.notification2.refresh_from_db()
        self.assertFalse(self.notification2.read)

    def test_set_notification_read_status_not_owned(self):
        # User2 trying to mark user1's notification as read
        client = self.authenticate_user2()
        response = client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=self.notification1.id),
            {"read_status": "true"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 404)  # Should not find the notification

    def test_set_notification_read_status_unauthenticated(self):
        response = self.client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=self.notification1.id),
            {"read_status": "true"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_mark_all_notifications_as_read(self):
        # Create an additional unread notification for user1
        notification4 = Notification.objects.create(
            user=self.user1,
            notification_type=self.new_discussion_type,
            data={
                'debate_title': self.debate1.title,
                'participant_username': self.user3.username
            },
            info_args={'discussion_id': self.discussion1.id}
        )
        
        client = self.authenticate_user1()
        response = client.post(reverse_lazy_api("mark_all_notifications_as_read"))
        self.assertEqual(response.status_code, 204)
        
        # Verify all notifications for user1 are marked as read
        self.notification1.refresh_from_db()
        self.notification2.refresh_from_db()
        notification4.refresh_from_db()
        self.assertTrue(self.notification1.read)
        self.assertTrue(self.notification2.read)
        self.assertTrue(notification4.read)
        
        # Verify user2's notification is still unread
        self.notification3.refresh_from_db()
        self.assertFalse(self.notification3.read)

    def test_mark_all_notifications_as_read_unauthenticated(self):
        response = self.client.post(reverse_lazy_api("mark_all_notifications_as_read"))
        self.assertEqual(response.status_code, 401)  # Should require authentication


class NotificationServiceTest(NotificationApiTestBase):
    def test_get_notifications(self):
        # Test getting all notifications for user1
        notifications = NotificationService.get_notifications(self.user1)
        self.assertEqual(notifications.count(), 2)
        
        # Test getting only unread notifications for user1
        notifications = NotificationService.get_notifications(self.user1, only_unread=True)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().id, self.notification1.id)
    
    def test_get_unread_count(self):
        # Test getting unread count for user1
        count = NotificationService.get_unread_count(self.user1)
        self.assertEqual(count, 1)
        
        # Test getting unread count for user2
        count = NotificationService.get_unread_count(self.user2)
        self.assertEqual(count, 1)
        
        # Test getting unread count for user3
        count = NotificationService.get_unread_count(self.user3)
        self.assertEqual(count, 0)
    
    def test_set_read_status(self):
        # Test marking notification1 as read
        success = NotificationService.set_read_status(self.notification1.id, self.user1, True)
        self.assertTrue(success)
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.read)
        
        # Test marking already read notification as read (should return False)
        success = NotificationService.set_read_status(self.notification1.id, self.user1, True)
        self.assertFalse(success)
        
        # Test marking a read notification as unread
        success = NotificationService.set_read_status(self.notification2.id, self.user1, False)
        self.assertTrue(success)
        self.notification2.refresh_from_db()
        self.assertFalse(self.notification2.read)
        
        # Test marking another user's notification
        success = NotificationService.set_read_status(self.notification1.id, self.user2, True)
        self.assertFalse(success)
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.read)  # Should still be read from the first test
    
    def test_mark_all_as_read(self):
        # Create an additional unread notification for user1
        notification4 = Notification.objects.create(
            user=self.user1,
            notification_type=self.new_discussion_type,
            data={
                'debate_title': self.debate1.title,
                'participant_username': self.user3.username
            },
            info_args={'discussion_id': self.discussion1.id}
        )
        
        # Mark all notifications as read for user1
        NotificationService.mark_all_as_read(self.user1)
        
        # Verify all notifications for user1 are marked as read
        self.notification1.refresh_from_db()
        self.notification2.refresh_from_db()
        notification4.refresh_from_db()
        self.assertTrue(self.notification1.read)
        self.assertTrue(self.notification2.read)
        self.assertTrue(notification4.read)
        
        # Verify user2's notification is still unread
        self.notification3.refresh_from_db()
        self.assertFalse(self.notification3.read)


class NotificationPaginationTest(NotificationApiTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # Create additional notifications for pagination testing
        for i in range(20):  # Create 20 additional notifications
            Notification.objects.create(
                user=cls.user1,
                notification_type=cls.new_message_type,
                data={
                    'debate_title': f"Test Debate {i}",
                    'participant_username': cls.user2.username
                },
                info_args={'discussion_id': cls.discussion1.id}
            )

    def test_notification_pagination(self):
        client = self.authenticate_user1()
        
        # Test first page (default page size is 15)
        response = client.get(reverse_lazy_api("get_notifications"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 15)
        
        # Test second page
        response = client.get(reverse_lazy_api("get_notifications"), {"page": 2})
        self.assertEqual(response.status_code, 200)
        # Should have 7 notifications (20 + 2 original user1 notifications - 15 from first page)
        self.assertEqual(len(response.json()["items"]), 7)


class NotificationManagerTest(NotificationApiTestBase):
    def test_create_new_discussion_notification(self):
        # Create a new discussion notification
        notification = Notification.objects.create_new_discussion_notification(
            user_to_notify=self.user3.id,
            other_user_name=self.user1.username,
            discussion_id=self.discussion1.id,
            debate_title=self.debate1.title
        )
        
        # Verify notification was created correctly
        self.assertEqual(notification.user.id, self.user3.id)
        self.assertEqual(notification.notification_type.name, 'new_discussion')
        self.assertEqual(notification.data['debate_title'], self.debate1.title)
        self.assertEqual(notification.data['participant_username'], self.user1.username)
        self.assertEqual(notification.info_args['discussion_id'], self.discussion1.id)
        self.assertFalse(notification.read)

    def test_create_new_message_notification(self):
        # Create a new message
        message = Message.objects.create(
            discussion=self.discussion1,
            author=self.user1,
            text="Test message"
        )
        
        # Create a new message notification
        notification = Notification.objects.create_new_message_notification(
            user=self.user2,
            message=message
        )
        
        # Verify notification was created correctly
        self.assertEqual(notification.user, self.user2)
        self.assertEqual(notification.notification_type.name, 'new_message')
        self.assertEqual(notification.data['debate_title'], self.debate1.title)
        self.assertEqual(notification.data['participant_username'], self.user1.username)
        self.assertEqual(notification.info_args['discussion_id'], self.discussion1.id)
        self.assertFalse(notification.read)

    def test_create_accepted_invite_notification(self):
        # Create an invite from user1 for debate1
        invite = InviteService.create_invite(self.user1, self.debate1.slug)

        # User2 accepts the invite
        invite_use = InviteService.accept_invite(invite.code, self.user2)

        # Get the latest notification for user1 (should be the accepted invite notification)
        notification = Notification.objects.filter(
            user=self.user1,
            notification_type__name='accepted_invite'
        ).latest('created_at')

        # Verify notification was created correctly
        self.assertEqual(notification.user, self.user1)
        self.assertEqual(notification.notification_type.name, 'accepted_invite')
        self.assertEqual(notification.data['debate_title'], self.debate1.title)
        self.assertEqual(notification.data['participant_username'], self.user2.username)
        self.assertEqual(notification.info_args['discussion_id'], invite_use.resulting_discussion.id)
        self.assertFalse(notification.read)


class NotificationEdgeCasesTest(NotificationApiTestBase):
    def test_get_notifications_no_notifications(self):
        # Create a user with no notifications
        user4 = User.objects.create_user(username='testuser4', email='user4@example.com', password='password123')
        
        # Authenticate as user4
        client = Client()
        client.login(username='testuser4', password='password123')
        
        # Test getting notifications
        response = client.get(reverse_lazy_api("get_notifications"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 0)
        
        # Test getting unread count
        response = client.get(reverse_lazy_api("get_notifications_unread_count"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), 0)
    
    def test_set_read_status_nonexistent_notification(self):
        client = self.authenticate_user1()
        response = client.patch(
            reverse_lazy_api("set_notification_read_status", notification_id=99999),
            {"read_status": "true"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 404)
