import asyncio
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

from ProjectOpenDebate.common.base_tests import BaseTransactionTestCase
from debate.models import Debate, Stance
from pairing.models import PairingRequest, PairingMatch
from discussion.models import Discussion

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
        self.user3 = User.objects.create_user(
            username='testuser3', email='user3@example.com', password='password123'
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
    def get_pairing_match(self, pairing_request):
        try:
            return PairingMatch.objects.select_related(
                'pairing_request_2', 'pairing_request_1'
            ).get(
                pairing_request_1=pairing_request
            )
        except PairingMatch.DoesNotExist:
            try:
                return PairingMatch.objects.select_related(
                    'pairing_request_1', 'pairing_request_2'
                ).get(
                    pairing_request_2=pairing_request
                )
            except PairingMatch.DoesNotExist:
                return None
    
    @database_sync_to_async
    def set_request_status(self, request, status):
        request.status = status
        request.save()
        return request
    
    @database_sync_to_async
    def expire_request(self, request):
        # Set keepalive ping to be older than expiry time
        request.last_keepalive_ping = timezone.now() - timedelta(
            seconds=settings.PAIRING_REQUEST_EXPIRY_SECONDS + 10
        )
        request.save()
        return request


class PairingRequestTests(PairingConsumerTestBase):
    async def test_create_pairing_request_success(self):
        """Test successfully creating a pairing request"""
        await self.setUpAsync()  # noqa
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send pairing request
        await communicator.send_json_to({
            "event_type": "request_pairing",
            "data": {
                "debate_id": self.debate.id,
                "desired_stance": -1  # User1 wants to be paired with someone AGAINST
            }
        })
        
        # Get response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "request_pairing")
        
        # Verify request was created in database
        pairing_request = await self.get_pairing_request(self.user1)
        self.assertIsNotNone(pairing_request)
        self.assertEqual(pairing_request.debate_id, self.debate.id)
        self.assertEqual(pairing_request.desired_stance, -1)
        self.assertEqual(pairing_request.status, PairingRequest.Status.IDLE)
        
        await communicator.disconnect()
    
    async def test_create_duplicate_pairing_request(self):
        """Test creating a pairing request when one already exists"""
        await self.setUpAsync()  # noqa
        
        # Create an existing request
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Try to create another request
        await communicator.send_json_to({
            "event_type": "request_pairing",
            "data": {
                "debate_id": self.debate.id,
                "desired_stance": 1
            }
        })
        
        # Get error response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("already have an active pairing request", response["message"])
        
        await communicator.disconnect()
    
    async def test_create_pairing_request_invalid_debate(self):
        """Test creating a pairing request with an invalid debate ID"""
        await self.setUpAsync()  # noqa
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send pairing request with invalid debate ID
        await communicator.send_json_to({
            "event_type": "request_pairing",
            "data": {
                "debate_id": 99999,  # Non-existent debate
                "desired_stance": -1
            }
        })
        
        # Get error response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("Debate does not exist", response["message"])
        
        await communicator.disconnect()
    
    async def test_create_pairing_request_invalid_payload(self):
        """Test creating a pairing request with invalid data"""
        await self.setUpAsync()  # noqa
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Send pairing request with missing fields
        await communicator.send_json_to({
            "event_type": "request_pairing",
            "data": {
                # Missing debate_id
                "desired_stance": -1
            }
        })
        
        # Get validation error
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("Invalid payload", response["message"])
        
        await communicator.disconnect()


class SearchAndMatchingTests(PairingConsumerTestBase):
    async def test_start_search_no_match(self):
        """Test starting a search when no matching requests exist"""
        await self.setUpAsync()  # noqa
        
        # Create a pairing request
        request = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Start search
        await communicator.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        
        # Get response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "start_search")
        
        # Verify request status was updated
        updated_request = await self.get_pairing_request(self.user1)
        self.assertEqual(updated_request.status, PairingRequest.Status.ACTIVE)
        
        await communicator.disconnect()
    
    async def test_start_search_with_match(self):
        """Test starting a search when a matching request exists"""
        await self.setUpAsync()  # noqa
        
        # Create two compatible pairing requests
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )  # User1 wants someone AGAINST
        await PairingRequest.objects.acreate(
            user=self.user2,
            debate=self.debate,
            desired_stance=1
        )   # User2 wants someone FOR
        
        # Connect both users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)
        
        # User1 starts search
        await communicator1.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        
        # First user should receive start_search event
        response1 = await communicator1.receive_json_from()
        self.assertEqual(response1["status"], "success")
        self.assertEqual(response1["event_type"], "start_search")

        # User2 starts search
        await communicator2.send_json_to({
            "event_type": "start_search",
            "data": {}
        })

        # Second user should receive match_found event
        response2 = await communicator2.receive_json_from()
        self.assertEqual(response2["status"], "success")
        self.assertEqual(response2["event_type"], "match_found")

        # User 1 should also receive match_found event
        response1_match = await communicator1.receive_json_from()
        self.assertEqual(response1_match["status"], "success")
        self.assertEqual(response1_match["event_type"], "match_found")
        
        # Verify pairing match was created in database
        user1_request = await self.get_pairing_request(self.user1)
        self.assertEqual(user1_request.status, PairingRequest.Status.MATCH_FOUND)
        
        user2_request = await self.get_pairing_request(self.user2)
        self.assertEqual(user2_request.status, PairingRequest.Status.MATCH_FOUND)
        
        # After a delay, both users should receive paired notification
        # Wait for the _wait_then_complete_pairing task to complete (3.5 seconds + buffer)
        await asyncio.sleep(4)
        
        paired_response1 = await communicator1.receive_json_from()
        paired_response2 = await communicator2.receive_json_from()
        
        self.assertEqual(paired_response1["status"], "success")
        self.assertEqual(paired_response1["event_type"], "paired")
        self.assertEqual(paired_response2["status"], "success")
        self.assertEqual(paired_response2["event_type"], "paired")
        
        # Verify discussion was created
        self.assertIsNotNone(paired_response1["data"]["discussion_id"])
        self.assertEqual(paired_response1["data"]["discussion_id"], paired_response2["data"]["discussion_id"])
        
        # Verify requests are now in PAIRED status
        await user1_request.arefresh_from_db()
        self.assertEqual(user1_request.status, PairingRequest.Status.PAIRED)
        
        await communicator1.disconnect()
        await communicator2.disconnect()
    
    async def test_start_search_no_request(self):
        """Test starting a search when no pairing request exists"""
        await self.setUpAsync()  # noqa
        
        # Connect user without creating a request
        communicator = await self.connect_client(self.user1)
        
        # Start search
        await communicator.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        
        # Get error response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("No current pairing request", response["message"])
        
        await communicator.disconnect()


class CancelPairingTests(PairingConsumerTestBase):
    async def test_cancel_pairing_success(self):
        """Test successfully cancelling a pairing request"""
        await self.setUpAsync()  # noqa
        
        # Create a pairing request
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Cancel request
        await communicator.send_json_to({
            "event_type": "cancel",
            "data": {}
        })
        
        # Get response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["event_type"], "cancel")
        self.assertTrue(response["data"]["from_current_user"])
        
        # Verify request was deleted
        pairing_request = await self.get_pairing_request(self.user1)
        self.assertIsNone(pairing_request)
        
        await communicator.disconnect()
    
    async def test_cancel_no_request(self):
        """Test cancelling when no pairing request exists"""
        await self.setUpAsync()  # noqa
        
        # Connect user without creating a request
        communicator = await self.connect_client(self.user1)
        
        # Cancel request
        await communicator.send_json_to({
            "event_type": "cancel",
            "data": {}
        })
        
        # Get error response
        response = await communicator.receive_json_from()
        
        self.assertEqual(response["status"], "error")
        self.assertIn("No current pairing request", response["message"])
        
        await communicator.disconnect()
    
    async def test_cancel_during_match_found(self):
        """Test cancellation when a match has been found but not yet completed"""
        await self.setUpAsync()  # noqa
        
        # Create two compatible pairing requests
        request1 = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        request2 = await PairingRequest.objects.acreate(
            user=self.user2,
            debate=self.debate,
            desired_stance=1
        )
        
        # Manually create a pairing match
        match = await database_sync_to_async(PairingMatch.objects.create_match_found)(request1, request2)
        
        # Connect both users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)
        
        # User1 tries to cancel
        await communicator1.send_json_to({
            "event_type": "cancel",
            "data": {}
        })
        
        # User1 should receive an error because cancellation is not allowed in MATCH_FOUND state
        response1 = await communicator1.receive_json_from()
        
        self.assertEqual(response1["status"], "error")
        self.assertIn("You cannot cancel a pairing request that is not active or idle", response1["message"])
        
        # Verify requests were NOT deleted
        pairing_request1 = await self.get_pairing_request(self.user1)
        pairing_request2 = await self.get_pairing_request(self.user2)
        self.assertIsNotNone(pairing_request1)
        self.assertIsNotNone(pairing_request2)
        
        await communicator1.disconnect()
        await communicator2.disconnect()


class KeepaliveTests(PairingConsumerTestBase):
    async def test_keepalive_success(self):
        """Test successful keepalive message"""
        await self.setUpAsync()  # noqa
        
        # Create a pairing request
        request = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
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
        self.assertEqual(response["event_type"], "keepalive_ack")  # Should still acknowledge keepalive
        
        await communicator.disconnect()
    
    async def test_request_expiry(self):
        """Test that expired requests are handled correctly"""
        await self.setUpAsync()  # noqa
        
        # Create a pairing request and expire it
        request = await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        await self.expire_request(request)
        
        # Connect user1
        communicator = await self.connect_client(self.user1)
        
        # Try to start search with expired request
        await communicator.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        
        # Should get error because request is considered expired
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "error")
        self.assertIn("No current pairing request", response["message"])
        
        await communicator.disconnect()


class RaceConditionTests(PairingConsumerTestBase):
    async def test_simultaneous_searches(self):
        """Test two users starting searches simultaneously"""
        await self.setUpAsync()  # noqa
        
        # Create two compatible pairing requests
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        await PairingRequest.objects.acreate(
            user=self.user2,
            debate=self.debate,
            desired_stance=1
        )
        
        # Connect both users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)
        
        # Both users start search simultaneously
        task1 = asyncio.create_task(communicator1.send_json_to({
            "event_type": "start_search",
            "data": {}
        }))
        task2 = asyncio.create_task(communicator2.send_json_to({
            "event_type": "start_search",
            "data": {}
        }))
        
        await asyncio.gather(task1, task2)
        
        # Both should receive match_found notifications
        responses = await asyncio.gather(
            communicator1.receive_json_from(),
            communicator2.receive_json_from()
        )

        # One should be match_found directly and the other start_search then right after match_found
        response1 = responses[0]
        response2 = responses[1]
        if response1["event_type"] == "match_found" and response2["event_type"] == "start_search":
            start_search_communicator = communicator2
        elif response2["event_type"] == "match_found" and response1["event_type"] == "start_search":
            start_search_communicator = communicator1
        else:
            self.fail("Unexpected event type received. One of the responses should be match_found and the other start_search.")

        # Wait for the start_search communicator to receive the match_found event
        response_start_search = await start_search_communicator.receive_json_from()
        self.assertEqual(response_start_search["status"], "success")
        self.assertEqual(response_start_search["event_type"], "match_found")
        
        # Wait for pairing to complete
        await asyncio.sleep(4)
        
        # Both should receive paired notifications
        paired_responses = await asyncio.gather(
            communicator1.receive_json_from(),
            communicator2.receive_json_from()
        )
        
        # Check all responses are for paired event
        discussion_ids = []
        for response in paired_responses:
            self.assertEqual(response["status"], "success")
            self.assertEqual(response["event_type"], "paired")
            discussion_ids.append(response["data"]["discussion_id"])
        
        # Both should have the same discussion ID
        self.assertEqual(discussion_ids[0], discussion_ids[1])
        
        # Verify only one discussion was created
        discussion_count = await database_sync_to_async(Discussion.objects.count)()
        self.assertEqual(discussion_count, 1)
        
        await communicator1.disconnect()
        await communicator2.disconnect()
    
    async def test_multiple_compatible_matches(self):
        """Test scenario with multiple compatible match candidates"""
        await self.setUpAsync()  # noqa

        await database_sync_to_async(Stance.objects.create)(user=self.user3, debate=self.debate, stance=-1)
        
        # Create three compatible pairing requests
        # User1 (FOR) wants AGAINST
        # User2 (AGAINST) wants FOR
        # User3 (AGAINST) wants FOR
        await PairingRequest.objects.acreate(
            user=self.user1,
            debate=self.debate,
            desired_stance=-1
        )
        await PairingRequest.objects.acreate(
            user=self.user2,
            debate=self.debate,
            desired_stance=1
        )
        await PairingRequest.objects.acreate(
            user=self.user3,
            debate=self.debate,
            desired_stance=1
        )
        
        # Connect all users
        communicator1 = await self.connect_client(self.user1)
        communicator2 = await self.connect_client(self.user2)
        communicator3 = await self.connect_client(self.user3)
        
        # User2 starts search
        await communicator2.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        
        # User2 should initially receive start_search event as it is the first to start search
        response2 = await communicator2.receive_json_from()
        self.assertEqual(response2["status"], "success")
        self.assertEqual(response2["event_type"], "start_search")

        # User3 starts search but doesnt match with user 2
        await communicator3.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        response3 = await communicator3.receive_json_from()
        self.assertEqual(response3["status"], "success")
        self.assertEqual(response3["event_type"], "start_search")

        # User1 starts search and matches with either user2 or user3
        await communicator1.send_json_to({
            "event_type": "start_search",
            "data": {}
        })
        response1 = await communicator1.receive_json_from()
        self.assertEqual(response1["status"], "success")
        self.assertEqual(response1["event_type"], "match_found")
        
        # See which user got matched
        user1_request = await self.get_pairing_request(self.user1)
        match = await self.get_pairing_match(user1_request)
        
        if match.pairing_request_1 == user1_request:
            matched_request = match.pairing_request_2
        elif match.pairing_request_2 == user1_request:
            matched_request = match.pairing_request_1
        else:
            self.fail("Matched request does not correspond to user1's request")
        
        # The matched user should receive notification
        if matched_request.user_id == self.user2.id:
            matched_communicator = communicator2
            unmatched_communicator = communicator3
        elif matched_request.user_id == self.user3.id:
            matched_communicator = communicator3
            unmatched_communicator = communicator2
        else:
            self.fail(f"Matched user is neither user2 nor user3 ({matched_request.user_id})")

        # Ensure that the matched user receives the match_found event as well
        matched_response = await matched_communicator.receive_json_from()
        self.assertEqual(matched_response["event_type"], "match_found")
        
        # Wait for pairing to complete
        await asyncio.sleep(4)
        
        # Matched users should receive paired notifications
        paired_response1 = await communicator1.receive_json_from()
        paired_response2 = await matched_communicator.receive_json_from()
        
        self.assertEqual(paired_response1["event_type"], "paired")
        self.assertEqual(paired_response2["event_type"], "paired")
        
        # Unmatched user should not get any response
        with self.assertRaises(asyncio.TimeoutError):
            await asyncio.wait_for(unmatched_communicator.receive_json_from(), timeout=0.5)
        
        await communicator1.disconnect()
        await communicator2.disconnect()
        await communicator3.disconnect()
