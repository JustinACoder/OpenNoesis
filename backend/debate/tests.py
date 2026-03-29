from io import BytesIO
from unittest.mock import patch

from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from ProjectOpenDebate.common.base_tests import BaseTestCase
from django.contrib.auth import get_user_model

from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate, Comment, Stance, Vote
from debate.schemas import VoteDirectionEnum, StanceDirectionEnum, CommentInputSchema, VoteInputSchema, \
    StanceInputSchema

from pairing.models import PairingRequest

User = get_user_model()


class DebateApiTestBase(BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        # Create test users
        cls.user1 = User.objects.create_user(username='testuser1', email='user1@example.com', password='password123')
        cls.user2 = User.objects.create_user(username='testuser2', email='user2@example.com', password='password123')

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

        # Create test comments
        cls.comment1 = Comment.objects.create(
            debate=cls.debate1,
            author=cls.user2,
            text="Comment from user2 on debate1"
        )
        cls.comment2 = Comment.objects.create(
            debate=cls.debate1,
            author=cls.user1,
            text="Comment from user1 on debate1"
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

    @staticmethod
    def create_test_image(name="debate.png"):
        return DebateApiTestBase.create_generated_test_image(name=name)

    @staticmethod
    def create_generated_test_image(
        *,
        width=1200,
        height=600,
        name="debate.png",
        image_format="PNG",
    ):
        file_obj = BytesIO()
        Image.new("RGB", (width, height), color=(24, 40, 72)).save(
            file_obj,
            format=image_format,
        )
        return SimpleUploadedFile(
            name,
            file_obj.getvalue(),
            content_type=f"image/{image_format.lower()}",
        )


class DebateListingEndpointsTest(DebateApiTestBase):
    def test_trending_debates_endpoint(self):
        response = self.client.get(reverse_lazy_api("trending_debates"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

    def test_popular_debates_endpoint(self):
        # Add votes to make a debate popular
        Vote.objects.record_vote(self.debate1, self.user1, VoteDirectionEnum.UP)
        Vote.objects.record_vote(self.debate1, self.user2, VoteDirectionEnum.UP)

        response = self.client.get(reverse_lazy_api("popular_debates"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(response.json()["items"][0]["title"], self.debate1.title)

    def test_recent_debates_endpoint(self):
        response = self.client.get(reverse_lazy_api("recent_debates"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

    def test_controversial_debates_endpoint(self):
        # Add opposing stances to create controversy
        Stance.objects.create(user=self.user1, debate=self.debate1, stance=StanceDirectionEnum.FOR)
        Stance.objects.create(user=self.user2, debate=self.debate1, stance=StanceDirectionEnum.AGAINST)

        response = self.client.get(reverse_lazy_api("controversial_debates"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

    def test_random_debates_endpoint(self):
        response = self.client.get(reverse_lazy_api("random_debates"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

    def test_search_debates_endpoint(self):
        # Search for a term in the debate title
        response = self.client.get(reverse_lazy_api("search_debates"), data={"query": "Test Debate"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertTrue(len(response.json()["items"]) > 0)

        # Search for a non-existent term
        response = self.client.get(reverse_lazy_api("search_debates"), data={"query": "NonExistentTerm"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 0)

    def test_pagination(self):
        # Create more debates to test pagination
        for i in range(15):
            Debate.objects.create(
                title=f"Extra Debate {i}",
                description=f"Description for extra debate {i}",
                author=self.user1
            )

        response = self.client.get(reverse_lazy_api("recent_debates"), query_params={"page": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 10)  # Default page size

        response = self.client.get(reverse_lazy_api("recent_debates"), query_params={"page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()["items"]) > 0)


class DebateCreationEndpointsTest(DebateApiTestBase):
    def test_create_debate_authenticated(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Should public schools ban mobile phones?",
                "description": "Smartphones can disrupt focus in class, but they can also support learning in emergencies and research tasks.",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["author"]["id"], self.user1.id)
        self.assertEqual(payload["title"], "Should public schools ban mobile phones?")
        self.assertEqual(payload["description"], "Smartphones can disrupt focus in class, but they can also support learning in emergencies and research tasks.")
        self.assertIn("slug", payload)
        self.assertTrue(Debate.objects.filter(slug=payload["slug"], author=self.user1).exists())

    def test_create_debate_unauthenticated(self):
        response = self.client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Should AI tutors replace homework?",
                "description": "Homework teaches consistency, but adaptive AI tutors might provide more personalized and actionable feedback to students.",
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_create_debate_title_conflict(self):
        client = self.authenticate_user2()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": self.debate1.title,
                "description": "Different description but same title should be rejected because titles are unique.",
            },
        )

        self.assertEqual(response.status_code, 409)

    def test_create_debate_trims_input(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "   Are cities safer with more CCTV cameras?   ",
                "description": "   Surveillance can improve investigations, but it may also reduce privacy and be unevenly deployed across neighborhoods.   ",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["title"], "Are cities safer with more CCTV cameras?")
        self.assertEqual(payload["description"], "Surveillance can improve investigations, but it may also reduce privacy and be unevenly deployed across neighborhoods.")

    def test_create_debate_rejects_whitespace_only_payload(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "        ",
                "description": "                              ",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(Debate.objects.filter(title="").exists())
        self.assertFalse(Debate.objects.filter(slug="").exists())

    def test_create_debate_rejects_title_short_after_whitespace_normalization(self):
        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "a       b",
                "description": "This description is intentionally long enough to satisfy minimum requirements.",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(Debate.objects.filter(title="a       b", author=self.user1).exists())

    @patch("debate.image_uploads.OpenAI")
    def test_create_debate_with_image(self, openai_cls):
        openai_cls.return_value.moderations.create.return_value.results = [
            type(
                "ModerationResult",
                (),
                {
                    "model_dump": staticmethod(
                        lambda mode="python": {
                            "categories": {
                                "sexual": False,
                                "sexual/minors": False,
                                "violence/graphic": False,
                            }
                        }
                    )
                },
            )()
        ]

        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Public transport should be free in large cities",
                "description": "Free transit could improve access and reduce car traffic, but it would require sustained public funding and service planning.",
                "image": self.create_test_image(),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("debate_images/", payload["image_url"])
        debate = Debate.objects.get(slug=payload["slug"])
        self.assertTrue(bool(debate.image))

    @patch("debate.image_uploads.OpenAI")
    def test_create_debate_rejects_graphic_image(self, openai_cls):
        openai_cls.return_value.moderations.create.return_value.results = [
            type(
                "ModerationResult",
                (),
                {
                    "model_dump": staticmethod(
                        lambda mode="python": {
                            "categories": {
                                "sexual": False,
                                "sexual/minors": False,
                                "violence/graphic": True,
                            }
                        }
                    )
                },
            )()
        ]

        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Animal testing should be banned worldwide",
                "description": "Supporters argue for medical progress, but critics argue that the ethical cost is too high and alternatives should replace it.",
                "image": self.create_test_image(),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("graphic violence", response.json()["detail"])
        self.assertFalse(Debate.objects.filter(title="Animal testing should be banned worldwide").exists())

    @patch("debate.image_uploads.OpenAI")
    def test_create_debate_rejects_extreme_aspect_ratio_image(self, openai_cls):
        openai_cls.return_value.moderations.create.return_value.results = [
            type(
                "ModerationResult",
                (),
                {
                    "model_dump": staticmethod(
                        lambda mode="python": {
                            "categories": {
                                "sexual": False,
                                "sexual/minors": False,
                                "violence/graphic": False,
                            }
                        }
                    )
                },
            )()
        ]

        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Billboards should be banned from residential districts",
                "description": "Residents may want quieter neighborhoods, but billboard restrictions also limit commercial visibility and advertising revenue.",
                "image": self.create_generated_test_image(width=3000, height=400),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("aspect ratio", response.json()["detail"])

    @patch("debate.image_uploads.OpenAI")
    def test_create_debate_rejects_oversized_pixel_count_image(self, openai_cls):
        openai_cls.return_value.moderations.create.return_value.results = [
            type(
                "ModerationResult",
                (),
                {
                    "model_dump": staticmethod(
                        lambda mode="python": {
                            "categories": {
                                "sexual": False,
                                "sexual/minors": False,
                                "violence/graphic": False,
                            }
                        }
                    )
                },
            )()
        ]

        client = self.authenticate_user1()
        response = client.post(
            reverse_lazy_api("create_debate"),
            {
                "title": "Cities should replace asphalt with permeable paving",
                "description": "Permeable materials can reduce flooding, but they may increase upfront maintenance costs and require different infrastructure planning.",
                "image": self.create_generated_test_image(width=3600, height=3400),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("megapixels", response.json()["detail"])


class DebateDetailEndpointsTest(DebateApiTestBase):
    def test_get_debate_detail(self):
        response = self.client.get(reverse_lazy_api("get_debate", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], self.debate1.title)
        self.assertEqual(response.json()["description"], self.debate1.description)

    def test_get_nonexistent_debate_detail(self):
        response = self.client.get(reverse_lazy_api("get_debate", debate_slug="abc-random-slug-09093242"))  # Non-existent ID
        self.assertEqual(response.status_code, 404)

    def test_debate_details_with_authenticated_user(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_debate", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)

    def test_get_debates_with_user_stance(self):
        # Create a stance for user1
        Stance.objects.create(user=self.user1, debate=self.debate1, stance=StanceDirectionEnum.FOR)

        # Unauthenticated access should be denied
        response = self.client.get(reverse_lazy_api("get_debates_with_user_stance"))
        self.assertEqual(response.status_code, 401)

        # Authenticated access should return debates with user stances
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_debates_with_user_stance"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["items"][0]["title"], self.debate1.title)

    def test_get_debate_suggestions(self):
        response = self.client.get(reverse_lazy_api("get_debate_suggestions", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())


class CommentEndpointsTest(DebateApiTestBase):
    def test_get_debate_comments(self):
        response = self.client.get(reverse_lazy_api("get_debate_comments", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 2)

    def test_get_debate_comments_authenticated(self):
        client = self.authenticate_user1()
        response = client.get(reverse_lazy_api("get_debate_comments", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())
        self.assertEqual(len(response.json()["items"]), 2)

    def test_create_comment_authenticated(self):
        client = self.authenticate_user1()
        text = "This is a new test comment"
        comment_data = CommentInputSchema(text=text).dict()
        response = client.post(
            reverse_lazy_api("create_comment", debate_slug=self.debate1.slug),
            data=comment_data,
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], text)
        self.assertEqual(response.json()["author"]["username"], self.user1.username)

    def test_create_comment_unauthenticated(self):
        text = "This comment should not be created"
        comment_data = CommentInputSchema(text=text).dict()
        response = self.client.post(reverse_lazy_api("create_comment", debate_slug=self.debate1.slug), data=comment_data,
                                    content_type='application/json')

        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_create_comment_nonexistent_debate(self):
        client = self.authenticate_user1()
        text = "This comment should not be created"
        comment_data = CommentInputSchema(text=text).dict()
        response = client.post(reverse_lazy_api("create_comment", debate_slug="abc-def-0981209182"), data=comment_data,
                               content_type='application/json')

        self.assertEqual(response.status_code, 404)  # Debate does not exist


class VotingEndpointsTest(DebateApiTestBase):
    def test_vote_on_debate_authenticated(self):
        client = self.authenticate_user1()

        # Test upvote
        vote_data = VoteInputSchema(direction=VoteDirectionEnum.UP).dict()
        response = client.patch(reverse_lazy_api("vote_on_debate", debate_slug=self.debate2.slug), data=vote_data,
                                content_type='application/json')
        self.assertEqual(response.status_code, 204)

        # Verify vote was recorded
        self.debate2.refresh_from_db()
        vote = Vote.objects.get(
            object_id=self.debate2.id,
            user=self.user1
        )
        self.assertEqual(vote.vote, VoteDirectionEnum.UP)

        # Test downvote
        vote_data = VoteInputSchema(direction=VoteDirectionEnum.DOWN).dict()
        response = client.patch(reverse_lazy_api("vote_on_debate", debate_slug=self.debate2.slug), data=vote_data,
                                content_type='application/json')
        self.assertEqual(response.status_code, 204)

        # Verify vote was updated
        vote.refresh_from_db()
        self.assertEqual(vote.vote, VoteDirectionEnum.DOWN)

    def test_vote_on_debate_unauthenticated(self):
        vote_data = VoteInputSchema(direction=VoteDirectionEnum.UP).dict()
        response = self.client.patch(reverse_lazy_api("vote_on_debate", debate_slug=self.debate1.slug), data=vote_data,
                                     content_type='application/json')
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_vote_on_comment_authenticated(self):
        client = self.authenticate_user1()

        vote_data = VoteInputSchema(direction=VoteDirectionEnum.UP).dict()
        response = client.patch(
            reverse_lazy_api("vote_on_comment", debate_slug=self.debate1.slug, comment_id=self.comment1.id),
            data=vote_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify vote was recorded
        vote = Vote.objects.get(
            object_id=self.comment1.id,
            user=self.user1
        )
        self.assertEqual(vote.vote, VoteDirectionEnum.UP)

    def test_vote_on_comment_unauthenticated(self):
        vote_data = VoteInputSchema(direction=VoteDirectionEnum.UP).dict()
        response = self.client.patch(
            reverse_lazy_api("vote_on_comment", debate_slug=self.debate1.slug, comment_id=self.comment1.id),
            data=vote_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication


class StanceEndpointsTest(DebateApiTestBase):
    def test_set_stance_authenticated(self):
        client = self.authenticate_user1()

        stance_data = StanceInputSchema(stance=StanceDirectionEnum.FOR).dict()
        response = client.patch(
            reverse_lazy_api("set_stance", debate_slug=self.debate2.slug),
            data=stance_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify stance was set
        stance = Stance.objects.get(debate=self.debate2, user=self.user1)
        self.assertEqual(stance.stance, StanceDirectionEnum.FOR)

        # Test changing stance
        stance_data = StanceInputSchema(stance=StanceDirectionEnum.AGAINST).dict()
        response = client.patch(
            reverse_lazy_api("set_stance", debate_slug=self.debate2.slug),
            data=stance_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify stance was updated
        stance.refresh_from_db()
        self.assertEqual(stance.stance, StanceDirectionEnum.AGAINST)

        # Test removing stance
        stance_data = StanceInputSchema(stance=StanceDirectionEnum.UNSET).dict()
        response = client.patch(
            reverse_lazy_api("set_stance", debate_slug=self.debate2.slug),
            data=stance_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 204)

        # Verify stance was removed
        self.assertFalse(Stance.objects.filter(debate=self.debate2, user=self.user1).exists())

    def test_set_stance_unauthenticated(self):
        stance_data = StanceInputSchema(stance=StanceDirectionEnum.FOR).dict()
        response = self.client.patch(
            reverse_lazy_api("set_stance", debate_slug=self.debate1.slug),
            data=stance_data,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)  # Should require authentication

    def test_set_stance_removes_discussion_requests(self):
        # Create a discussion request
        request = PairingRequest.objects.create(
            user=self.user1,
            debate=self.debate1,
            desired_stance=StanceDirectionEnum.FOR
        )

        # Set a stance
        client = self.authenticate_user1()
        stance_data = StanceInputSchema(stance=StanceDirectionEnum.FOR).dict()
        response = client.patch(
            reverse_lazy_api("set_stance", debate_slug=self.debate1.slug),
            data=stance_data,
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 204)

        # Verify discussion request was removed
        self.assertFalse(
            PairingRequest.objects.filter(
                user=self.user1,
                debate=self.debate1,
                is_matched=False
            ).exists()
        )
