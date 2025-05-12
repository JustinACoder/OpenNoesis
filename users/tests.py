from django.test import Client
from django.contrib.auth import get_user_model
from django.db import transaction

from ProjectOpenDebate.common.base_tests import BaseTestCase
from ProjectOpenDebate.common.utils import reverse_lazy_api
from users.models import Profile

User = get_user_model()


class UserApiTestBase(BaseTestCase):
    def setUp(self):
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1', 
            email='user1@example.com', 
            password='password123'
        )
        self.user2 = User.objects.create_user(
            username='testuser2', 
            email='user2@example.com', 
            password='password123'
        )
        
        # Update profiles with bio
        self.user1.profile.bio = "Test bio for user1"
        self.user1.profile.save()
        
        self.user2.profile.bio = "Test bio for user2"
        self.user2.profile.save()

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
        
    def authenticate_admin(self):
        client = Client()
        client.login(username='admin', password='admin123')
        return client


class UserProfileEndpointsTest(UserApiTestBase):
    def test_get_public_user_profile_authenticated(self):
        # Test authenticated access to public profile
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_public_user_profile", user_id=self.user2.id))
        self.assertEqual(response.status_code, 200)
        
        # Check that the correct data is returned
        data = response.json()
        self.assertEqual(data["id"], self.user2.id)
        self.assertEqual(data["username"], "testuser2")
        self.assertNotIn("email", data)  # Email should not be in public profile
        
    def test_get_public_user_profile_unauthenticated(self):
        # Test unauthenticated access to public profile (should be allowed)
        response = self.client.get(reverse_lazy_api("get_public_user_profile", user_id=self.user2.id))
        self.assertEqual(response.status_code, 200)
        
        # Check that the correct data is returned
        data = response.json()
        self.assertEqual(data["id"], self.user2.id)
        self.assertEqual(data["username"], "testuser2")
        
    def test_get_public_user_profile_nonexistent(self):
        # Test getting a profile for a user that doesn't exist
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_public_user_profile", user_id=999))
        self.assertEqual(response.status_code, 404)
        
    def test_get_private_user_profile(self):
        # Test accessing own private profile
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_private_user_profile"))
        self.assertEqual(response.status_code, 200)
        
        # Check that the correct data is returned including private fields
        data = response.json()
        self.assertEqual(data["id"], self.user1.id)
        self.assertEqual(data["username"], "testuser1")
        self.assertEqual(data["email"], "user1@example.com")
        self.assertEqual(data["bio"], "Test bio for user1")
        
    def test_get_private_user_profile_unauthenticated(self):
        # Test unauthenticated access to private profile (should be rejected)
        response = self.client.get(reverse_lazy_api("get_private_user_profile"))
        self.assertEqual(response.status_code, 401)
        
    def test_update_user_profile(self):
        # Test updating user profile
        client = self.authenticate_user1()
        update_data = {"bio": "Updated bio for user1"}
        
        response = client.patch(
            reverse_lazy_api("update_private_user_profile"),
            data=update_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)
        
        # Check that the profile was updated
        self.user1.refresh_from_db()
        self.user1.profile.refresh_from_db()
        self.assertEqual(self.user1.profile.bio, "Updated bio for user1")
        
    def test_update_user_profile_unauthenticated(self):
        # Test unauthenticated attempt to update profile
        update_data = {"bio": "Should not update"}
        
        response = self.client.patch(
            reverse_lazy_api("update_private_user_profile"),
            data=update_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)
        
    def test_update_user_profile_empty_payload(self):
        # Test updating with empty payload
        client = self.authenticate_user1()
        update_data = {}
        
        response = client.patch(
            reverse_lazy_api("update_private_user_profile"),
            data=update_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("No data provided for update", response.json().get("detail", ""))
        
    def test_update_user_profile_invalid_data(self):
        # Test updating with invalid data (bio too long)
        client = self.authenticate_user1()
        update_data = {"bio": "x" * 3000}  # Bio has max_length=2048
        
        response = client.patch(
            reverse_lazy_api("update_private_user_profile"),
            data=update_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 422)  # Validation error


class ProfileModelTest(UserApiTestBase):
    def test_profile_created_on_user_creation(self):
        # Test the signal that creates a profile when a user is created
        with transaction.atomic():
            new_user = User.objects.create_user(
                username='newuser',
                email='newuser@example.com',
                password='newpass123'
            )
            
            # Check that profile was created
            self.assertTrue(hasattr(new_user, 'profile'))
            self.assertIsInstance(new_user.profile, Profile)
