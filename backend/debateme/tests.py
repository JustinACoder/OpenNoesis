from django.test import Client
from ProjectOpenDebate.common.base_tests import BaseTestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate
from debateme.models import Invite, InviteUse
from debateme.services import InviteService, DisallowedActionError
from discussion.models import Discussion

User = get_user_model()


class InviteTestBase(BaseTestCase):
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

        # Create test invites
        cls.invite1 = Invite.objects.create(
            creator=cls.user1,
            debate=cls.debate1,
            code="abcdefgh"  # Override the default random generation for testing
        )
        cls.invite2 = Invite.objects.create(
            creator=cls.user2,
            debate=cls.debate2,
            code="12345678"  # Override the default random generation for testing
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


class InviteServiceTest(InviteTestBase):
    def test_get_invite_by_code(self):
        # Test retrieving an existing invite
        invite = InviteService.get_invite_by_code(self.invite1.code)
        self.assertEqual(invite.id, self.invite1.id)
        self.assertEqual(invite.creator, self.user1)
        self.assertEqual(invite.debate, self.debate1)

        # Test retrieving a non-existent invite
        with self.assertRaises(Exception):
            InviteService.get_invite_by_code("nonexistent")

    def test_get_user_invites(self):
        # Test getting invites for a user who created invites
        invites = InviteService.get_user_invites(self.user1)
        self.assertEqual(invites.count(), 1)
        self.assertEqual(invites.first().code, self.invite1.code)

        # Test getting invites for a user with no invites
        invites = InviteService.get_user_invites(self.user3)
        self.assertEqual(invites.count(), 0)

    def test_create_invite(self):
        # Test creating a new invite
        invite = InviteService.create_invite(self.user3, self.debate1.slug)
        self.assertEqual(invite.creator, self.user3)
        self.assertEqual(invite.debate, self.debate1)
        self.assertIsNotNone(invite.code)

        # Test creating an invite for a non-existent debate
        with self.assertRaises(Exception):
            InviteService.create_invite(self.user3, "nonexistent-slug")

    def test_accept_invite(self):
        # Test successfully accepting an invite
        invite_use = InviteService.accept_invite(self.invite1.code, self.user2)
        self.assertEqual(invite_use.invite, self.invite1)
        self.assertEqual(invite_use.user, self.user2)
        self.assertIsNotNone(invite_use.resulting_discussion)
        self.assertEqual(invite_use.resulting_discussion.debate, self.debate1)

        # Test that accepting an invite creates a Discussion
        discussion = invite_use.resulting_discussion # type: Discussion
        self.assertTrue(isinstance(discussion, Discussion))
        participants = [discussion.participant1, discussion.participant2]
        self.assertTrue(self.user1 in participants)
        self.assertTrue(self.user2 in participants)

    def test_accept_own_invite(self):
        # Test that a user cannot accept their own invite
        with self.assertRaises(DisallowedActionError) as context:
            InviteService.accept_invite(self.invite1.code, self.user1)
        self.assertEqual(str(context.exception), "Cannot accept your own invite")

    def test_accept_invite_twice(self):
        # First acceptance should succeed
        InviteService.accept_invite(self.invite1.code, self.user2)

        # Second acceptance by the same user should fail
        with self.assertRaises(DisallowedActionError) as context:
            InviteService.accept_invite(self.invite1.code, self.user2)
        self.assertEqual(str(context.exception), "Invite already accepted")

        # Another user should still be able to accept the same invite
        invite_use = InviteService.accept_invite(self.invite1.code, self.user3)
        self.assertEqual(invite_use.invite, self.invite1)
        self.assertEqual(invite_use.user, self.user3)

    def test_delete_invite(self):
        # Test deleting an invite by its creator
        result = InviteService.delete_invite(self.invite1.code, self.user1)
        self.assertTrue(result)
        self.assertFalse(Invite.objects.filter(code=self.invite1.code).exists())

        # Test deleting an invite by a non-creator (should fail)
        result = InviteService.delete_invite(self.invite2.code, self.user1)
        self.assertFalse(result)
        self.assertTrue(Invite.objects.filter(code=self.invite2.code).exists())

        # Test deleting a non-existent invite
        result = InviteService.delete_invite("nonexistent", self.user1)
        self.assertFalse(result)


class InviteApiEndpointsTest(InviteTestBase):
    def test_list_invites_authenticated(self):
        # Create another invite for user1
        Invite.objects.create(creator=self.user1, debate=self.debate2)
        
        # Test with authenticated user
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("list_invites"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 2)
        
        # Check response structure
        first_item = response.json()["items"][0]
        self.assertIn("code", first_item)
        self.assertIn("created_at", first_item)
        self.assertIn("debate", first_item)
        self.assertIn("creator", first_item)

    def test_list_invites_unauthenticated(self):
        # Test with unauthenticated user
        response = self.client.get(reverse_lazy_api("list_invites"))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_create_invite_authenticated(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_invite"),
            {"debate_slug": self.debate2.slug},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("code", response.json())
        self.assertEqual(response.json()["creator"]["id"], self.user1.id)
        self.assertEqual(response.json()["debate"]["id"], self.debate2.id)

    def test_create_invite_unauthenticated(self):
        response = self.client.post(
            reverse_lazy_api("create_invite"),
            {"debate_slug": self.debate2.slug},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_create_invite_nonexistent_debate(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_invite"),
            {"debate_slug": "nonexistent-debate-slug"},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)

    def test_view_invite_authenticated(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("view_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], self.invite1.code)
        self.assertEqual(response.json()["creator"]["id"], self.user1.id)
        self.assertEqual(response.json()["debate"]["id"], self.debate1.id)

    def test_view_invite_unauthenticated(self):
        # View invite should work even without authentication
        response = self.client.get(reverse_lazy_api("view_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], self.invite1.code)

    def test_view_nonexistent_invite(self):
        response = self.client.get(reverse_lazy_api("view_invite", invite_code="nonexistent"))
        self.assertEqual(response.status_code, 404)

    def test_accept_invite_authenticated(self):
        # Test accepting an invite by an authenticated user
        client = self.authenticate_user2()
        response = client.post(reverse_lazy_api("accept_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 200)
        self.assertIn("resulting_discussion", response.json())
        self.assertEqual(response.json()["user"]["id"], self.user2.id)
        
        # Verify the invite use was created
        self.assertTrue(InviteUse.objects.filter(invite=self.invite1, user=self.user2).exists())

    def test_accept_invite_unauthenticated(self):
        # Test accepting an invite without authentication
        response = self.client.post(reverse_lazy_api("accept_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_accept_own_invite_api(self):
        # Test that a user cannot accept their own invite via API
        client = self.authenticate_user1()
        response = client.post(reverse_lazy_api("accept_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 403)  # Forbidden
        self.assertIn("Cannot accept your own invite", response.json()["detail"])

    def test_accept_nonexistent_invite(self):
        client = self.authenticate_user2()
        response = client.post(reverse_lazy_api("accept_invite", invite_code="nonexistent"))
        self.assertEqual(response.status_code, 404)

    def test_delete_invite_authenticated_owner(self):
        # Test deleting an invite by its creator
        client = self.authenticate_user1()
        response = client.delete(reverse_lazy_api("delete_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Invite.objects.filter(code=self.invite1.code).exists())

    def test_delete_invite_authenticated_non_owner(self):
        # Test deleting an invite by a non-creator (should fail)
        client = self.authenticate_user2()
        response = client.delete(reverse_lazy_api("delete_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Invite.objects.filter(code=self.invite1.code).exists())

    def test_delete_invite_unauthenticated(self):
        # Test deleting an invite without authentication
        response = self.client.delete(reverse_lazy_api("delete_invite", invite_code=self.invite1.code))
        self.assertEqual(response.status_code, 401)  # Should require authentication
        self.assertTrue(Invite.objects.filter(code=self.invite1.code).exists())

    def test_delete_nonexistent_invite(self):
        client = self.authenticate_user1()
        response = client.delete(reverse_lazy_api("delete_invite", invite_code="nonexistent"))
        self.assertEqual(response.status_code, 404)


class InviteModelTest(BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.user = User.objects.create_user(username='testuser', email='test@example.com', password='password123')
        cls.debate = Debate.objects.create(
            title="Test Debate",
            description="Description for test debate",
            author=cls.user
        )

    def test_invite_creation(self):
        # Test that an invite is created with a default code
        invite = Invite.objects.create(creator=self.user, debate=self.debate)
        self.assertIsNotNone(invite.code)
        self.assertEqual(len(invite.code), 8)
        self.assertEqual(invite.creator, self.user)
        self.assertEqual(invite.debate, self.debate)
        self.assertTrue(isinstance(invite.created_at, timezone.datetime))
