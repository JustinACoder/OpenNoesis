import asyncio
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

from ProjectOpenDebate.common.base_tests import BaseTransactionTestCase
from debate.models import Debate, Stance
from pairing.models import PairingRequest

User = get_user_model()


class PairingConsumerTestBase(BaseTransactionTestCase):
    STREAM_NAME = "pairing"
    
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

        # Create test debate
        self.debate = Debate.objects.create(
            title="Test Debate",
            description="Description for test debate",
            author=self.user1
        )
        
        # Create stances for users on the debate
        Stance.objects.create(user=self.user1, debate=self.debate, stance=1)  # FOR
        Stance.objects.create(user=self.user2, debate=self.debate, stance=-1)  # AGAINST
    
    @database_sync_to_async
    def get_pairing_request(self, user):
        return PairingRequest.objects.get_current_request(user)
    
    @database_sync_to_async
    def expire_request(self, request):
        # Set keepalive ping to be older than expiry time
        request.last_keepalive_ping = timezone.now() - timedelta(
            seconds=settings.PAIRING_REQUEST_EXPIRY_SECONDS + 10
        )
        request.save()
        return request


class KeepaliveTests(PairingConsumerTestBase):
    async def test_keepalive_success(self):
        """Test successful keepalive message"""
        await self.setUpAsync()  # noqa
        
        # Create an active pairing request
        request = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1,
            status=PairingRequest.Status.ACTIVE
        )
        old_time = request.last_keepalive_ping
        
        # Wait a moment to ensure timestamp changes
        await asyncio.sleep(0.1)
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send keepalive
        await communicator.send_json_to({
            "event_type": "keepalive",
            "data": {}
        })
        
        # Get response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "keepalive_ack")
        
        # Verify keepalive timestamp was updated
        updated_request = await self.get_pairing_request(self.user1)
        self.assertGreater(updated_request.last_keepalive_ping, old_time)
        
        await communicator.disconnect()
    
    async def test_keepalive_no_request(self):
        """Test keepalive when no pairing request exists"""
        await self.setUpAsync()  # noqa
        
        # Connect user without creating a request
        communicator = await self.connect_client(self.user1)
        
        # Send keepalive
        await communicator.send_json_to({
            "event_type": "keepalive",
            "data": {}
        })
        
        # Get error response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("No active pairing request", response["message"])
        self.assertEqual(response["event_type"], "keepalive_ack")

        await communicator.disconnect()
    
    async def test_keepalive_expired_request(self):
        """Test keepalive with an expired request"""
        await self.setUpAsync()  # noqa
        
        # Create a pairing request and expire it
        request = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1,
            status=PairingRequest.Status.ACTIVE
        )
        await self.expire_request(request)
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send keepalive
        await communicator.send_json_to({
            "event_type": "keepalive",
            "data": {}
        })
        
        # Should get error because request is expired
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("No active pairing request", response["message"])

        await communicator.disconnect()

    async def test_keepalive_passive_request(self):
        """Test that keepalive doesn't work for passive requests"""
        await self.setUpAsync()  # noqa

        # Create a passive pairing request
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1,
            status=PairingRequest.Status.PASSIVE
        )
        
        # Connect user1
        communicator = await self.connect_client(self.user1)

        # Send keepalive
        await communicator.send_json_to({
            "event_type": "keepalive",
            "data": {}
        })
        
        # Should get error - passive requests don't need keepalive
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("No active pairing request", response["message"])

        await communicator.disconnect()
