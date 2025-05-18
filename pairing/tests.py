from datetime import datetime, timedelta
from unittest.mock import patch

from django.test import Client
from django.contrib.auth import get_user_model
from django.utils import timezone

from ProjectOpenDebate.common.base_tests import BaseTestCase
from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate, Stance
from discussion.models import Discussion, ReadCheckpoint
from pairing.models import PairingRequest, PairingMatch
from pairing.tasks import try_pairing_passive_requests

User = get_user_model()


class PairingTestBase(BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        # Create test users
        cls.user1 = User.objects.create_user(username='testuser1', email='user1@example.com', password='password123')
        cls.user2 = User.objects.create_user(username='testuser2', email='user2@example.com', password='password123')
        cls.user3 = User.objects.create_user(username='testuser3', email='user3@example.com', password='password123')
        cls.user4 = User.objects.create_user(username='testuser4', email='user4@example.com', password='password123')

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

        # Create test stances
        Stance.objects.create(
            user=cls.user1,
            debate=cls.debate1,
            stance=1  # FOR
        )
        Stance.objects.create(
            user=cls.user2,
            debate=cls.debate1,
            stance=-1  # AGAINST
        )
        Stance.objects.create(
            user=cls.user3,
            debate=cls.debate1,
            stance=1  # FOR
        )
        Stance.objects.create(
            user=cls.user4,
            debate=cls.debate1,
            stance=-1  # AGAINST
        )

        # Create client
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

    def authenticate_user4(self):
        client = Client()
        client.login(username='testuser4', password='password123')
        return client


class PassivePairingRequestTest(PairingTestBase):
    def test_request_passive_pairing(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("request_passive_pairing"),
            data={"debate_id": self.debate1.id, "stance_wanted": -1},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 204)

        # Verify pairing request was created
        self.assertTrue(
            PairingRequest.objects.filter(
                user=self.user1,
                debate=self.debate1,
                status=PairingRequest.Status.PASSIVE,
                desired_stance=-1
            ).exists()
        )

    def test_duplicate_request_fails(self):
        # Create initial request
        PairingRequest.objects.create(
            user=self.user1,
            debate=self.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=-1
        )

        # Try to create duplicate request
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("request_passive_pairing"),
            data={"debate_id": self.debate1.id, "stance_wanted": -1},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"detail": "You already have a passive pairing request for this debate and stance."}
        )

    def test_invalid_stance_value(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("request_passive_pairing"),
            data={"debate_id": self.debate1.id, "stance_wanted": 0},  # Invalid stance
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 422)  # Validation error

    def test_unauthenticated_request_fails(self):
        response = self.client.post(
            reverse_lazy_api("request_passive_pairing"),
            data={"debate_id": self.debate1.id, "stance_wanted": -1},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)


class GetCurrentActivePairingTest(PairingTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # Create an active pairing request
        cls.active_request = PairingRequest.objects.create(
            user=cls.user1,
            debate=cls.debate1,
            status=PairingRequest.Status.ACTIVE,
            desired_stance=-1
        )

    def test_get_current_active_pairing(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_current_active_pairing"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.active_request.id)
        self.assertEqual(response.json()["status"], PairingRequest.Status.ACTIVE)

    def test_get_current_active_pairing_when_none_exists(self):
        client = self.authenticate_user2()
        response = client.get(reverse_lazy_api("get_current_active_pairing"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json())

    def test_unauthenticated_request_fails(self):
        response = self.client.get(reverse_lazy_api("get_current_active_pairing"))
        self.assertEqual(response.status_code, 401)

    def test_expired_pairing_not_returned(self):
        # Set last_keepalive_ping to a time beyond the expiry window
        self.active_request.last_keepalive_ping = timezone.now() - timedelta(hours=1)
        self.active_request.save()

        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_current_active_pairing"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json())


class PairingMatchingTest(PairingTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # Create pairing requests that should match
        # User1 (FOR stance) wants to debate someone AGAINST
        cls.request1 = PairingRequest.objects.create(
            user=cls.user1,
            debate=cls.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=-1,
        )
        cls.request1.created_at = timezone.now() - timedelta(minutes=10)  # Older than grace period
        cls.request1.save()
        
        # User2 (AGAINST stance) wants to debate someone FOR
        cls.request2 = PairingRequest.objects.create(
            user=cls.user2,
            debate=cls.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=1,
        )
        cls.request2.created_at = timezone.now() - timedelta(minutes=10)  # Older than grace period
        cls.request2.save()

    def test_passive_pairing_match(self):
        # Run the task to match the requests
        try_pairing_passive_requests()
        
        # Verify requests were matched
        self.request1.refresh_from_db()
        self.request2.refresh_from_db()
        
        self.assertEqual(self.request1.status, PairingRequest.Status.PAIRED)
        self.assertEqual(self.request2.status, PairingRequest.Status.PAIRED)
        
        # Verify a pairing match was created
        pairing_match = PairingMatch.objects.filter(
            pairing_request_1=self.request1,
            pairing_request_2=self.request2
        ).first() or PairingMatch.objects.filter(
            pairing_request_1=self.request2,
            pairing_request_2=self.request1
        ).first()
        
        self.assertIsNotNone(pairing_match)
        
        # Verify a discussion was created
        self.assertIsNotNone(pairing_match.related_discussion)
        
        # Verify read checkpoints were created
        self.assertEqual(
            ReadCheckpoint.objects.filter(discussion=pairing_match.related_discussion).count(),
            2
        )

    @patch('pairing.tasks.GRACE_PERIOD', timedelta(minutes=1))
    def test_pairing_respects_grace_period(self):
        # Create a new request that's newer than the grace period
        new_request = PairingRequest.objects.create(
            user=self.user3,
            debate=self.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=-1,
        ) # just created, so it's too new
        
        # Run the task
        try_pairing_passive_requests()
        
        # The new request should not be paired because it's too new
        new_request.refresh_from_db()
        self.assertEqual(new_request.status, PairingRequest.Status.PASSIVE)

    def test_pairing_match_completes_correctly(self):
        # Run the task to match the requests
        try_pairing_passive_requests()
        
        # Find the match
        pairing_match = PairingMatch.objects.filter(
            pairing_request_1__user=self.user1,
            pairing_request_2__user=self.user2
        ).first() or PairingMatch.objects.filter(
            pairing_request_1__user=self.user2,
            pairing_request_2__user=self.user1
        ).first()
        
        self.assertIsNotNone(pairing_match)
        
        # Verify discussion is created
        discussion = pairing_match.related_discussion
        self.assertIsNotNone(discussion)
        
        # Verify discussion has correct participants
        self.assertTrue(
            (discussion.participant1 == self.user1 and discussion.participant2 == self.user2) or
            (discussion.participant1 == self.user2 and discussion.participant2 == self.user1)
        )
        
        # Verify discussion has correct debate
        self.assertEqual(discussion.debate, self.debate1)
        
        # Verify read checkpoints were created
        self.assertEqual(ReadCheckpoint.objects.filter(discussion=discussion).count(), 2)
        self.assertTrue(ReadCheckpoint.objects.filter(discussion=discussion, user=self.user1).exists())
        self.assertTrue(ReadCheckpoint.objects.filter(discussion=discussion, user=self.user2).exists())

    def test_handle_multiple_matching_pairs(self):
        # Add another matching pair of requests
        request3 = PairingRequest.objects.create(
            user=self.user3, # is for
            debate=self.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=-1,
        )
        request3.created_at = timezone.now() - timedelta(minutes=10)  # Older than grace period
        request3.save()
        
        request4 = PairingRequest.objects.create(
            user=self.user4, # is against
            debate=self.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=1,
        )
        request4.created_at = timezone.now() - timedelta(minutes=10)  # Older than grace period
        request4.save()
        
        # Run the task
        try_pairing_passive_requests()
        
        # Verify both pairs were matched
        self.request1.refresh_from_db()
        self.request2.refresh_from_db()
        request3.refresh_from_db()
        request4.refresh_from_db()
        
        self.assertEqual(self.request1.status, PairingRequest.Status.PAIRED)
        self.assertEqual(self.request2.status, PairingRequest.Status.PAIRED)
        self.assertEqual(request3.status, PairingRequest.Status.PAIRED)
        self.assertEqual(request4.status, PairingRequest.Status.PAIRED)
        
        # Verify two discussions were created
        self.assertEqual(Discussion.objects.count(), 2)
        
        # Verify two pairing matches were created
        self.assertEqual(PairingMatch.objects.count(), 2)


class PairingRequestManagerTest(PairingTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # Create an active request
        cls.active_request = PairingRequest.objects.create(
            user=cls.user1,
            debate=cls.debate1,
            status=PairingRequest.Status.ACTIVE,
            desired_stance=-1,
        )
        
        # Create an idle request
        cls.idle_request = PairingRequest.objects.create(
            user=cls.user2,
            debate=cls.debate1,
            status=PairingRequest.Status.IDLE,
            desired_stance=1,
        )
        
        # Create a passive request
        cls.passive_request = PairingRequest.objects.create(
            user=cls.user3,
            debate=cls.debate1,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=-1,
        )
        cls.passive_request.last_keepalive_ping = timezone.now() - timedelta(minutes=30)
        cls.passive_request.save()
        
        # Create an expired request
        cls.expired_request = PairingRequest.objects.create(
            user=cls.user4,
            debate=cls.debate2,
            status=PairingRequest.Status.ACTIVE,
            desired_stance=1,
        )
        cls.expired_request.last_keepalive_ping = timezone.now() - timedelta(hours=1)
        cls.expired_request.save()

    def test_get_current_request(self):
        # Test active request is returned
        current_request = PairingRequest.objects.get_current_request(self.user1)
        self.assertEqual(current_request, self.active_request)
        
        # Test idle request is returned
        current_request = PairingRequest.objects.get_current_request(self.user2)
        self.assertEqual(current_request, self.idle_request)
        
        # Test expired request is not returned
        current_request = PairingRequest.objects.get_current_request(self.user4)
        self.assertIsNone(current_request)
        
        # Test passive request is not returned (not considered "current")
        current_request = PairingRequest.objects.get_current_request(self.user3)
        self.assertIsNone(current_request)

    def test_get_best_match(self):
        # Create potential match for self.active_request
        matching_request = PairingRequest.objects.create(
            user=self.user2,
            debate=self.debate1,
            status=PairingRequest.Status.ACTIVE,
            desired_stance=1,
        )
        
        # Test finding matching request
        best_match = PairingRequest.objects.get_best_match(self.active_request)
        self.assertEqual(best_match, matching_request)
        
        # Test no match for different statuses
        best_match = PairingRequest.objects.get_best_match(self.passive_request)
        self.assertIsNone(best_match)


class PairingMatchModelTest(PairingTestBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # Create requests
        cls.request1 = PairingRequest.objects.create(
            user=cls.user1,
            debate=cls.debate1,
            status=PairingRequest.Status.MATCH_FOUND,
            desired_stance=-1
        )
        
        cls.request2 = PairingRequest.objects.create(
            user=cls.user2,
            debate=cls.debate1,
            status=PairingRequest.Status.MATCH_FOUND,
            desired_stance=1
        )
        
        # Create match
        cls.match = PairingMatch.objects.create(
            pairing_request_1=cls.request1,
            pairing_request_2=cls.request2
        )

    def test_get_debate(self):
        self.assertEqual(self.match.get_debate(), self.debate1)

    def test_get_other_request(self):
        # Test getting other request
        other_request = self.match.get_other_request(self.request1)
        self.assertEqual(other_request, self.request2)
        
        other_request = self.match.get_other_request(self.request2)
        self.assertEqual(other_request, self.request1)

    def test_complete_match(self):
        # Test completing match
        discussion = self.match.complete_match()
        
        # Verify requests changed status
        self.request1.refresh_from_db()
        self.request2.refresh_from_db()
        self.assertEqual(self.request1.status, PairingRequest.Status.PAIRED)
        self.assertEqual(self.request2.status, PairingRequest.Status.PAIRED)
        
        # Verify discussion was created
        self.assertIsNotNone(discussion)
        self.assertEqual(self.match.related_discussion, discussion)
        
        # Verify discussion has correct debate and participants
        self.assertEqual(discussion.debate, self.debate1)
        self.assertTrue(
            (discussion.participant1 == self.user1 and discussion.participant2 == self.user2) or
            (discussion.participant1 == self.user2 and discussion.participant2 == self.user1)
        )
