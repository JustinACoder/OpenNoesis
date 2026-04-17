import json
from io import BytesIO
from io import StringIO
from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.base import ContentFile
from django.utils import timezone
from PIL import Image
from ProjectOpenDebate.common.base_tests import BaseTestCase
from django.contrib.auth import get_user_model
import requests

from ProjectOpenDebate.common.utils import reverse_lazy_api
from debate.models import Debate, Comment, Stance, Vote
from debate.models import GeneratedDebateCandidate
from debate.schemas import VoteDirectionEnum, StanceDirectionEnum, CommentInputSchema, VoteInputSchema, \
    StanceInputSchema
from debate.services import GeneratedDebateCandidateService
from debate.tasks.generate_candidates import (
    GeneratedDebateCandidateOutput,
    GeneratedDebateCandidatesOutput,
    GeneratedDebatePipelineResult,
    _build_debate_generation_prompt,
    _generate_candidates_from_reddit,
    run_generated_debate_pipeline,
)
from debate.tasks.review_notifications import _send_discord_message, send_generated_debate_candidates_to_discord
from debate.reddit_retrieval import (
    ComparativeRedditSeedSelectionOutput,
    ComparativeRedditSeedSelectionOutputItem,
    RedditDebateSeedSelection,
    RedditPost,
    RedditShortlistItem,
    build_reddit_shortlist,
    run_reddit_debate_seed_selection_pipeline,
    select_reddit_debate_seed_candidates,
    _request_with_backoff,
    _percentile_normalize,
    _rank_subreddit_posts,
)
from pairing.models import PairingRequest

User = get_user_model()


class DebateApiTestBase(BaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        # Create test users
        cls.user1 = User.objects.create_user(username='testuser1', email='user1@example.com', password='password123')
        cls.user2 = User.objects.create_user(username='testuser2', email='user2@example.com', password='password123')
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            email='staff@example.com',
            password='password123',
            is_staff=True,
        )

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

    def authenticate_staff_user(self):
        client = Client()
        client.login(username='staffuser', password='password123')
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

    def test_recent_debates_description_preview_strips_markdown(self):
        Debate.objects.create(
            title="Public libraries should lend video game consoles",
            description="**Libraries** help with access.\n\n- They lower cost barriers.\n- They can link people to [community events](https://example.com).",
            author=self.user1
        )

        response = self.client.get(reverse_lazy_api("recent_debates"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["items"][0]["description_preview"],
            "Libraries help with access. - They lower cost barriers. - They can link people to community events.",
        )

    def test_hidden_debates_do_not_appear_in_recent_list_even_for_staff(self):
        Debate.objects.create(
            title="Hidden debate for moderation",
            description="This debate should never appear in listings even for staff users viewing public sections.",
            author=self.user1,
            hidden=True,
        )

        response = self.authenticate_staff_user().get(reverse_lazy_api("recent_debates"))

        self.assertEqual(response.status_code, 200)
        returned_titles = [item["title"] for item in response.json()["items"]]
        self.assertNotIn("Hidden debate for moderation", returned_titles)

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

    def test_hidden_debate_detail_is_not_accessible_publicly(self):
        hidden_debate = Debate.objects.create(
            title="Moderation only debate",
            description="This hidden debate should only be accessible by direct URL for staff users.",
            author=self.user1,
            hidden=True,
        )

        response = self.client.get(reverse_lazy_api("get_debate", debate_slug=hidden_debate.slug))

        self.assertEqual(response.status_code, 404)

    def test_hidden_debate_detail_is_accessible_to_staff_by_direct_url(self):
        hidden_debate = Debate.objects.create(
            title="Staff visible hidden debate",
            description="Staff can access this debate directly, but it must stay out of public lists and search.",
            author=self.user1,
            hidden=True,
        )

        response = self.authenticate_staff_user().get(
            reverse_lazy_api("get_debate", debate_slug=hidden_debate.slug)
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["slug"], hidden_debate.slug)

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

    def test_get_featured_debate(self):
        self.debate1.featured_on = timezone.localdate() - timedelta(days=1)
        self.debate1.save(update_fields=["featured_on"])
        self.debate2.featured_on = timezone.localdate()
        self.debate2.save(update_fields=["featured_on"])

        response = self.client.get(reverse_lazy_api("get_featured"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()["items"]
        self.assertEqual(len(payload), 2)
        self.assertEqual(payload[0]["slug"], self.debate2.slug)
        self.assertEqual(payload[1]["slug"], self.debate1.slug)

    def test_get_featured_debate_respects_limit(self):
        self.debate1.featured_on = timezone.localdate() - timedelta(days=2)
        self.debate1.save(update_fields=["featured_on"])
        self.debate2.featured_on = timezone.localdate() - timedelta(days=1)
        self.debate2.save(update_fields=["featured_on"])
        debate3 = Debate.objects.create(
            title="Workers should have a four-day workweek by default",
            description="A shorter workweek may improve wellbeing and productivity, but some jobs are harder to compress without service tradeoffs.",
            author=self.user1,
            featured_on=timezone.localdate(),
        )

        response = self.client.get(reverse_lazy_api("get_featured"), data={"page": 1})

        self.assertEqual(response.status_code, 200)
        payload = response.json()["items"]
        self.assertEqual(len(payload), 3)
        self.assertEqual(payload[0]["slug"], debate3.slug)
        self.assertEqual(payload[1]["slug"], self.debate2.slug)


class CommentEndpointsTest(DebateApiTestBase):
    def test_get_debate_comments(self):
        response = self.client.get(reverse_lazy_api("get_debate_comments", debate_slug=self.debate1.slug))
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.json())

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

    def test_hidden_debate_comments_are_not_accessible_publicly(self):
        hidden_debate = Debate.objects.create(
            title="Hidden comment debate",
            description="Public users should not be able to load comments for this hidden debate.",
            author=self.user1,
            hidden=True,
        )
        Comment.objects.create(
            debate=hidden_debate,
            author=self.user2,
            text="Hidden comment",
        )

        response = self.client.get(
            reverse_lazy_api("get_debate_comments", debate_slug=hidden_debate.slug)
        )

        self.assertEqual(response.status_code, 404)

    def test_hidden_debate_comments_are_accessible_to_staff_by_direct_url(self):
        hidden_debate = Debate.objects.create(
            title="Hidden staff comment debate",
            description="Staff users can inspect comments on a hidden debate by direct URL.",
            author=self.user1,
            hidden=True,
        )
        Comment.objects.create(
            debate=hidden_debate,
            author=self.user2,
            text="Hidden comment for staff",
        )

        response = self.authenticate_staff_user().get(
            reverse_lazy_api("get_debate_comments", debate_slug=hidden_debate.slug)
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 1)


class GeneratedDebateCandidateServiceTest(DebateApiTestBase):
    def test_create_or_update_candidate_records_similarity_and_review_state(self):
        candidate = GeneratedDebateCandidateService.create_or_update_candidate(
            title=self.debate1.title,
            short_description="A short generated summary that should be skipped because the debate already exists.",
        )
        self.assertIsNone(candidate)

        candidate = GeneratedDebateCandidateService.create_or_update_candidate(
            title="Cities should ban facial recognition in public spaces",
            short_description="Supporters argue it protects civil liberties while critics say it limits public safety tools.",
            generated_description="Facial recognition can help identify threats, but it can also normalize pervasive surveillance and produce biased results.",
        )

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.status, GeneratedDebateCandidate.Status.NEEDS_REVIEW)
        self.assertTrue(candidate.debate.hidden)
        self.assertEqual(candidate.debate.title, "Cities should ban facial recognition in public spaces")
        self.assertEqual(
            candidate.debate.description,
            "Facial recognition can help identify threats, but it can also normalize pervasive surveillance and produce biased results.",
        )
        self.assertEqual(candidate.similarity_payload, [])

    def test_rediscovery_preserves_rejected_state(self):
        draft_debate = Debate.objects.create(
            title="Cities should ban facial recognition in public spaces",
            description="Original description.",
            author=None,
            hidden=True,
        )
        candidate = GeneratedDebateCandidate.objects.create(
            debate=draft_debate,
            short_description="Original summary.",
            status=GeneratedDebateCandidate.Status.REJECTED,
        )

        refreshed = GeneratedDebateCandidateService.create_or_update_candidate(
            title="Cities should ban facial recognition in public spaces",
            short_description="Updated summary from a later discovery run.",
            generated_description="Updated long-form description.",
        )

        self.assertEqual(refreshed.id, candidate.id)
        self.assertEqual(refreshed.status, GeneratedDebateCandidate.Status.REJECTED)
        self.assertEqual(refreshed.short_description, "Updated summary from a later discovery run.")
        self.assertEqual(refreshed.debate.description, "Updated long-form description.")

    def test_publish_candidate_creates_featured_debate(self):
        draft_debate = Debate.objects.create(
            title="Schools should ban phones during class",
            description="Banning phones in class may improve attention and reduce distraction, but it may also remove a useful educational and safety tool.",
            author=None,
            hidden=True,
        )
        candidate = GeneratedDebateCandidate.objects.create(
            debate=draft_debate,
            short_description="Phones distract students, though they can also help with emergencies and research.",
            status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        )
        candidate.debate.image.save(
            "candidate-cover.jpg",
            ContentFile(self.create_generated_test_image(image_format="JPEG").read(), name="candidate-cover.jpg"),
        )

        debate = GeneratedDebateCandidateService.publish_candidate(candidate)

        self.assertEqual(debate.id, candidate.debate_id)
        self.assertEqual(debate.title, candidate.debate.title)
        self.assertEqual(debate.description, candidate.debate.description)
        self.assertEqual(debate.featured_on, timezone.localdate())
        self.assertTrue(bool(debate.image))
        self.assertFalse(debate.hidden)
        self.assertEqual(candidate.status, GeneratedDebateCandidate.Status.PUBLISHED)

    def test_approve_candidate_publishes_immediately(self):
        draft_debate = Debate.objects.create(
            title="Public schools should teach personal finance",
            description="Personal finance classes could improve long-term decision making, though they would compete with other curriculum priorities.",
            author=None,
            hidden=True,
        )
        candidate = GeneratedDebateCandidate.objects.create(
            debate=draft_debate,
            short_description="Students should learn taxes, budgeting, and debt before adulthood.",
            status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        )

        approved = GeneratedDebateCandidateService.approve_candidate(candidate)

        self.assertEqual(approved.status, GeneratedDebateCandidate.Status.PUBLISHED)
        self.assertFalse(approved.debate.hidden)
        self.assertIsNotNone(approved.approved_at)
        self.assertIsNotNone(approved.published_at)

    def test_create_or_update_candidate_truncates_overlong_generated_title(self):
        candidate = GeneratedDebateCandidateService.create_or_update_candidate(
            title="This is a very long generated debate title that keeps going well past the database limit and should be truncated safely before saving",
            short_description="Generated summary.",
            generated_description="Generated description.",
        )

        self.assertIsNotNone(candidate)
        self.assertLessEqual(len(candidate.debate.title), 100)
        self.assertTrue(candidate.debate.title.endswith("…"))


class GeneratedDebatePipelineCommandTest(DebateApiTestBase):
    def test_build_debate_generation_prompt_includes_full_sections(self):
        seed_selection = RedditDebateSeedSelection(
            rank=1,
            identifier="reddit_candidate_1",
            reason="This is broad, socially live, and easy to turn into a durable proposition.",
            suggested_debate_statement="Working from the office is better than working remotely",
            suitability_score=0.92,
            shortlist_item=RedditShortlistItem(
                identifier="reddit_candidate_1",
                heuristic_rank=1,
                subreddit_rank=1,
                post=RedditPost(
                    subreddit="unpopularopinion",
                    title="People would prefer working from the office if commute costs were lower",
                    url="https://www.reddit.com/example",
                ),
            ),
        )
        prompt = _build_debate_generation_prompt(
            seed_selection=seed_selection,
        )

        self.assertIn("## Overview", prompt)
        self.assertIn("Selected Reddit seed", prompt)
        self.assertIn("Suggested debate statement", prompt)
        self.assertIn("homepage-worthy", prompt)
        self.assertIn("Weak debate seeds often look like these", prompt)
        self.assertIn("## Title Rules", prompt)
        self.assertIn("Maximum 15 words.", prompt)
        self.assertIn("## Description Rules", prompt)
        self.assertIn("must never exceed 1500 words", prompt)
        self.assertIn("## Markdown Rules", prompt)
        self.assertIn("([Source Name](https://example.com))", prompt)

    @override_settings(
        OPENAI_API_KEY="test-key",
        OPENAI_MODEL="gpt-5",
        OPENAI_TIMEOUT_SECONDS=30,
        AUTO_DEBATE_GENERATION_CANDIDATE_COUNT=3,
        AI_MAX_OUTPUT_TOKENS=512,
    )
    @patch("debate.tasks.generate_candidates.run_reddit_debate_seed_selection_pipeline")
    @patch("debate.tasks.generate_candidates.OpenAI")
    def test_generate_candidates_from_reddit_uses_structured_outputs(self, openai_mock, selection_mock):
        selection_mock.return_value = type(
            "SelectionResult",
            (),
            {
                "selected": [
                    RedditDebateSeedSelection(
                        rank=1,
                        identifier="reddit_candidate_1",
                        reason="Broad and durable work-life tradeoff.",
                        suggested_debate_statement="Working from the office is better than working remotely",
                        suitability_score=0.91,
                        shortlist_item=RedditShortlistItem(
                            identifier="reddit_candidate_1",
                            heuristic_rank=1,
                            subreddit_rank=1,
                            post=RedditPost(
                                subreddit="unpopularopinion",
                                title="People would prefer working from the office if commute costs were lower",
                                url="https://www.reddit.com/example",
                            ),
                        ),
                    )
                ]
            },
        )()
        response_mock = openai_mock.return_value.responses.parse
        response_mock.return_value = type(
            "Response",
            (),
            {
                "output_parsed": GeneratedDebateCandidatesOutput(
                    candidates=[
                        GeneratedDebateCandidateOutput(
                            title="Working from the office is better than working remotely",
                            short_description="Office work may improve collaboration while remote work offers flexibility and autonomy.",
                            generated_description="Body",
                            source_links=[],
                        )
                    ]
                )
            },
        )()

        candidates = _generate_candidates_from_reddit()

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].title, "Working from the office is better than working remotely")
        _, client_kwargs = openai_mock.call_args
        self.assertEqual(client_kwargs["timeout"], 60)
        kwargs = response_mock.call_args.kwargs
        self.assertEqual(kwargs["tools"], [{"type": "web_search"}])
        self.assertEqual(kwargs["text_format"], GeneratedDebateCandidatesOutput)
        self.assertEqual(kwargs["max_output_tokens"], 4000)
        self.assertIsInstance(kwargs["input"], list)
        selection_mock.assert_called_once()

    @override_settings(
        OPENAI_API_KEY="test-key",
        OPENAI_MODEL="gpt-5",
        OPENAI_TIMEOUT_SECONDS=30,
        AUTO_DEBATE_GENERATION_CANDIDATE_COUNT=3,
        AI_MAX_OUTPUT_TOKENS=512,
    )
    @patch("debate.tasks.generate_candidates.run_reddit_debate_seed_selection_pipeline")
    @patch("debate.tasks.generate_candidates.OpenAI")
    def test_generate_candidates_from_reddit_raises_after_missing_structured_output(self, openai_mock, selection_mock):
        selection_mock.return_value = type(
            "SelectionResult",
            (),
            {
                "selected": [
                    RedditDebateSeedSelection(
                        rank=1,
                        identifier="reddit_candidate_1",
                        reason="Broad and durable work-life tradeoff.",
                        suggested_debate_statement="Working from the office is better than working remotely",
                        suitability_score=0.91,
                        shortlist_item=RedditShortlistItem(
                            identifier="reddit_candidate_1",
                            heuristic_rank=1,
                            subreddit_rank=1,
                            post=RedditPost(
                                subreddit="unpopularopinion",
                                title="People would prefer working from the office if commute costs were lower",
                                url="https://www.reddit.com/example",
                            ),
                        ),
                    )
                ]
            },
        )()
        response_mock = openai_mock.return_value.responses.parse
        response_mock.return_value = type(
            "Response",
            (),
            {
                "output_parsed": None,
                "output": [],
                "incomplete_details": None,
                "status": "completed",
            },
        )()

        with self.assertRaises(RuntimeError) as exc:
            _generate_candidates_from_reddit()

        self.assertIn("no structured output", str(exc.exception))
        self.assertEqual(response_mock.call_count, 1)

    @override_settings(
        OPENAI_API_KEY="test-key",
        OPENAI_MODEL="gpt-5",
        OPENAI_TIMEOUT_SECONDS=30,
        AUTO_DEBATE_GENERATION_CANDIDATE_COUNT=3,
        AI_MAX_OUTPUT_TOKENS=512,
    )
    @patch("debate.tasks.generate_candidates.run_reddit_debate_seed_selection_pipeline")
    def test_generate_candidates_from_reddit_enforces_minimum_selected_seed_count(self, selection_mock):
        selection_mock.return_value = type("SelectionResult", (), {"selected": []})()

        with self.assertRaises(RuntimeError):
            _generate_candidates_from_reddit(minimum_candidates=1)

    @override_settings(AUTO_DEBATE_GENERATION_ENABLED=True, AUTO_DEBATE_IMAGE_GENERATION_ENABLED=False)
    @patch("debate.tasks.generate_candidates.send_generated_debate_candidates_to_discord", return_value=1)
    @patch("debate.tasks.generate_candidates._generate_candidates_from_reddit")
    def test_run_generated_debate_pipeline_reports_breakdown(self, generate_candidates_mock, discord_mock):
        generate_candidates_mock.return_value = [
            GeneratedDebateCandidateOutput(
                title="Public transit should be free in large cities",
                short_description="Free transit could improve access while raising funding and service questions.",
                generated_description="Making transit free may expand mobility and reduce congestion, but it still requires sustainable funding and reliable service quality.",
                source_links=["https://example.com/source-1"],
            ),
            GeneratedDebateCandidateOutput(
                title=self.debate1.title,
                short_description="Duplicate public debate.",
                generated_description="Duplicate public debate description.",
                source_links=[],
            ),
            GeneratedDebateCandidateOutput(
                title="",
                short_description="Missing title should be skipped.",
                generated_description="",
                source_links=[],
            ),
        ]

        result = run_generated_debate_pipeline(send_discord_notifications=True)

        self.assertEqual(
            result,
            GeneratedDebatePipelineResult(
                created_or_updated=1,
                duplicates_skipped=1,
                invalid_candidates_skipped=1,
                discord_notifications_sent=1,
            ),
        )
        self.assertTrue(
            Debate.objects.filter(
                title="Public transit should be free in large cities",
                hidden=True,
            ).exists()
        )
        discord_mock.assert_called_once()

    @patch("debate.management.commands.run_generated_debate_pipeline.run_generated_debate_pipeline")
    def test_management_command_raises_command_error_for_runtime_failure(self, pipeline_mock):
        pipeline_mock.side_effect = RuntimeError("OpenAI candidate generation failed: timeout")

        with self.assertRaises(CommandError):
            call_command("run_generated_debate_pipeline")

    @patch(
        "debate.management.commands.run_generated_debate_pipeline.run_generated_debate_pipeline",
        return_value=GeneratedDebatePipelineResult(
            created_or_updated=2,
            duplicates_skipped=3,
            invalid_candidates_skipped=1,
            discord_notifications_sent=2,
        ),
    )
    def test_management_command_prints_breakdown(self, pipeline_mock):
        stdout = StringIO()

        call_command("run_generated_debate_pipeline", stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("Generated debate pipeline completed.", output)
        self.assertIn("Candidates created or updated: 2", output)
        self.assertIn("Duplicates skipped: 3", output)
        self.assertIn("Invalid candidates skipped: 1", output)
        self.assertIn("Discord notifications sent: 2", output)
        pipeline_mock.assert_called_once_with(send_discord_notifications=True, minimum_candidates=0)

    @patch("debate.management.commands.run_generated_debate_pipeline.run_generated_debate_pipeline")
    def test_management_command_passes_minimum_candidates(self, pipeline_mock):
        pipeline_mock.return_value = GeneratedDebatePipelineResult()

        call_command("run_generated_debate_pipeline", min_candidates=1)

        pipeline_mock.assert_called_once_with(send_discord_notifications=True, minimum_candidates=1)

    @override_settings(
        FRONTEND_URL="http://localhost:3000",
        AUTO_DEBATE_DISCORD_WEBHOOK_URL="https://discord.example/webhook",
    )
    @patch("debate.tasks.review_notifications.urlopen")
    def test_discord_notification_includes_hidden_debate_url(self, urlopen_mock):
        draft_debate = Debate.objects.create(
            title="Public parks should close overnight",
            description="Some cities close parks overnight for safety and maintenance reasons, while others keep them open for broader access.",
            hidden=True,
        )
        candidate = GeneratedDebateCandidate.objects.create(
            debate=draft_debate,
            short_description="Overnight closures may improve safety but reduce public access.",
            status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        )

        _send_discord_message(candidate, "Review this draft debate.")

        request = urlopen_mock.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        expected_url = f"http://localhost:3000/d/{draft_debate.slug}"

        self.assertIn(expected_url, payload["content"])
        self.assertEqual(payload["embeds"][0]["url"], expected_url)


class RedditRetrievalTest(BaseTestCase):
    @patch("debate.reddit_retrieval.time.sleep")
    def test_request_with_backoff_retries_before_success(self, sleep_mock):
        response = Mock()
        response.raise_for_status.return_value = None

        first_failure = requests.HTTPError("429 Client Error")
        first_failure.response = Mock(status_code=429)
        second_failure = requests.HTTPError("429 Client Error")
        second_failure.response = Mock(status_code=429)

        session = Mock()
        session.get.side_effect = [first_failure, second_failure, response]

        result = _request_with_backoff(
            session=session,
            url="https://www.reddit.com/r/test/hot/.rss?limit=10",
            request_timeout=15,
            context="Reddit RSS for r/test",
        )

        self.assertIs(result, response)
        self.assertEqual(session.get.call_count, 3)
        sleep_mock.assert_any_call(1)
        sleep_mock.assert_any_call(5)
        self.assertEqual(sleep_mock.call_count, 2)

    @patch("debate.reddit_retrieval.time.sleep")
    def test_request_with_backoff_returns_none_after_exhaustion(self, sleep_mock):
        failure = requests.HTTPError("429 Client Error")
        failure.response = Mock(status_code=429)

        session = Mock()
        session.get.side_effect = [failure, failure, failure, failure]

        result = _request_with_backoff(
            session=session,
            url="https://www.reddit.com/r/test/hot/.rss?limit=10",
            request_timeout=15,
            context="Reddit RSS for r/test",
        )

        self.assertIsNone(result)
        self.assertEqual(session.get.call_count, 4)
        sleep_mock.assert_any_call(1)
        sleep_mock.assert_any_call(5)
        sleep_mock.assert_any_call(20)
        self.assertEqual(sleep_mock.call_count, 3)

    def test_percentile_normalize_handles_missing_values_and_ties(self):
        normalized = _percentile_normalize([1.0, 5.0, None, 5.0])

        self.assertEqual(normalized[0], 0.0)
        self.assertEqual(normalized[1], 0.75)
        self.assertIsNone(normalized[2])
        self.assertEqual(normalized[3], 0.75)

    def test_rank_subreddit_posts_uses_available_features_when_upvote_ratio_missing(self):
        posts = [
            RedditPost(
                subreddit="news",
                title="Post A",
                url="https://www.reddit.com/r/news/comments/a/post_a/",
                comment_count=10,
                upvote_ratio=None,
            ),
            RedditPost(
                subreddit="news",
                title="Post B",
                url="https://www.reddit.com/r/news/comments/b/post_b/",
                comment_count=100,
                upvote_ratio=None,
            ),
            RedditPost(
                subreddit="news",
                title="Post C",
                url="https://www.reddit.com/r/news/comments/c/post_c/",
                comment_count=1000,
                upvote_ratio=None,
            ),
        ]

        ranked = _rank_subreddit_posts(posts)

        self.assertEqual([post.title for post in ranked], ["Post C", "Post B", "Post A"])
        self.assertEqual(ranked[0].normalized_features["normalized_comments"], 1.0)
        self.assertIsNone(ranked[0].normalized_features["normalized_disagreement"])
        self.assertEqual(ranked[0].normalized_score, 1.0)

    def test_rank_subreddit_posts_normalizes_within_subreddit(self):
        posts = [
            RedditPost(
                subreddit="changemyview",
                title="Low comments but high disagreement",
                url="https://www.reddit.com/r/changemyview/comments/a/post_a/",
                comment_count=10,
                upvote_ratio=0.55,
            ),
            RedditPost(
                subreddit="changemyview",
                title="Middle post",
                url="https://www.reddit.com/r/changemyview/comments/b/post_b/",
                comment_count=50,
                upvote_ratio=0.75,
            ),
            RedditPost(
                subreddit="changemyview",
                title="High comments but low disagreement",
                url="https://www.reddit.com/r/changemyview/comments/c/post_c/",
                comment_count=500,
                upvote_ratio=0.95,
            ),
        ]

        ranked = _rank_subreddit_posts(posts)

        self.assertEqual(ranked[0].title, "High comments but low disagreement")
        self.assertAlmostEqual(ranked[0].normalized_score, 0.7, places=3)
        self.assertAlmostEqual(ranked[1].normalized_score, 0.5, places=3)
        self.assertAlmostEqual(ranked[2].normalized_score, 0.3, places=3)

    @patch("debate.reddit_retrieval._fetch_subreddit_posts")
    def test_build_reddit_shortlist_balances_subreddits_and_applies_cap(self, fetch_mock):
        fetch_mock.side_effect = [
            [
                RedditPost(
                    subreddit="AskReddit",
                    title="AskReddit A",
                    url="https://example.com/a",
                    comment_count=500,
                    upvote_ratio=0.80,
                ),
                RedditPost(
                    subreddit="AskReddit",
                    title="AskReddit B",
                    url="https://example.com/b",
                    comment_count=300,
                    upvote_ratio=0.70,
                ),
            ],
            [
                RedditPost(
                    subreddit="changemyview",
                    title="CMV A",
                    url="https://example.com/c",
                    comment_count=200,
                    upvote_ratio=0.40,
                ),
                RedditPost(
                    subreddit="changemyview",
                    title="CMV B",
                    url="https://example.com/d",
                    comment_count=150,
                    upvote_ratio=0.60,
                ),
            ],
        ]

        shortlist = build_reddit_shortlist(
            per_subreddit_limit=10,
            subreddits=["AskReddit", "changemyview"],
            per_subreddit_rank_limit=1,
            shortlist_limit=2,
        )

        self.assertEqual(len(shortlist), 2)
        self.assertEqual(shortlist[0].identifier, "reddit_candidate_1")
        self.assertEqual(shortlist[1].identifier, "reddit_candidate_2")
        self.assertEqual({item.post.subreddit for item in shortlist}, {"AskReddit", "changemyview"})
        self.assertEqual(shortlist[0].heuristic_rank, 1)
        self.assertEqual(shortlist[1].heuristic_rank, 2)
        self.assertEqual(fetch_mock.call_count, 2)

    @override_settings(
        OPENAI_API_KEY="test-key",
        OPENAI_MODEL="gpt-5",
        OPENAI_TIMEOUT_SECONDS=30,
        AI_MAX_OUTPUT_TOKENS=512,
    )
    @patch("debate.reddit_retrieval.OpenAI")
    def test_select_reddit_debate_seed_candidates_uses_comparative_structured_output(self, openai_mock):
        response_mock = openai_mock.return_value.responses.parse
        response_mock.return_value = type(
            "Response",
            (),
            {
                "output_parsed": ComparativeRedditSeedSelectionOutput(
                    candidates=[
                        ComparativeRedditSeedSelectionOutputItem(
                            rank=1,
                            identifier="reddit_candidate_2",
                            reason="This is broad, intuitive, and easily generalized into a clean proposition.",
                            suggested_debate_statement="Remote work should be the default for office jobs",
                            suitability_score=0.88,
                        )
                    ]
                )
            },
        )()
        shortlist = [
            RedditShortlistItem(
                identifier="reddit_candidate_1",
                heuristic_rank=1,
                subreddit_rank=1,
                post=RedditPost(
                    subreddit="news",
                    title="Narrow event update",
                    url="https://example.com/news",
                    comment_count=100,
                    upvote_ratio=0.95,
                    normalized_score=0.9,
                ),
            ),
            RedditShortlistItem(
                identifier="reddit_candidate_2",
                heuristic_rank=2,
                subreddit_rank=1,
                post=RedditPost(
                    subreddit="AskReddit",
                    title="A broader cultural tension",
                    url="https://example.com/ask",
                    comment_count=80,
                    upvote_ratio=0.75,
                    normalized_score=0.8,
                ),
            ),
        ]

        selected = select_reddit_debate_seed_candidates(
            shortlist=shortlist,
            selection_limit=1,
        )

        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0].identifier, "reddit_candidate_2")
        self.assertEqual(selected[0].shortlist_item.post.title, "A broader cultural tension")
        self.assertEqual(
            selected[0].suggested_debate_statement,
            "Remote work should be the default for office jobs",
        )
        self.assertEqual(selected[0].suitability_score, 0.88)
        kwargs = response_mock.call_args.kwargs
        self.assertEqual(kwargs["text_format"], ComparativeRedditSeedSelectionOutput)
        self.assertEqual(kwargs["reasoning"], {"effort": "medium"})
        self.assertEqual(kwargs["model"], "gpt-5")
        self.assertIn("best 1 candidate", kwargs["input"][1]["content"])
        self.assertIn("suggested debate statement", kwargs["input"][1]["content"])

    @patch("debate.reddit_retrieval.select_reddit_debate_seed_candidates")
    @patch("debate.reddit_retrieval.build_reddit_shortlist")
    def test_run_reddit_debate_seed_selection_pipeline_combines_stages(self, shortlist_mock, select_mock):
        shortlist_item = RedditShortlistItem(
            identifier="reddit_candidate_1",
            heuristic_rank=1,
            subreddit_rank=1,
            post=RedditPost(
                subreddit="AskReddit",
                title="Remote work should be the default",
                url="https://www.reddit.com/r/AskReddit/comments/abc123/example/",
                comment_count=1234,
                upvote_ratio=0.61,
                raw_features={"log_comment_count": 7.119, "disagreement": 0.39},
                normalized_features={"normalized_comments": 0.95, "normalized_disagreement": 0.65},
                raw_score=2.776,
                normalized_score=0.86,
            ),
        )
        shortlist_mock.return_value = [shortlist_item]
        select_mock.return_value = []

        result = run_reddit_debate_seed_selection_pipeline(
            selection_limit=2,
            shortlist_limit=4,
            per_subreddit_limit=10,
            per_subreddit_rank_limit=2,
            subreddits=["AskReddit"],
        )

        self.assertEqual(result.shortlist, [shortlist_item])
        self.assertEqual(result.selected, [])
        shortlist_mock.assert_called_once_with(
            per_subreddit_limit=10,
            subreddits=["AskReddit"],
            per_subreddit_rank_limit=2,
            listing="hot",
            request_timeout=None,
            session=None,
            shortlist_limit=4,
        )
        select_mock.assert_called_once_with(
            shortlist=[shortlist_item],
            selection_limit=2,
            client=None,
        )

    @patch("debate.management.commands.inspect_reddit_pipeline.run_reddit_debate_seed_selection_pipeline")
    def test_management_command_prints_shortlist_and_selected_results(self, pipeline_mock):
        shortlist_item = RedditShortlistItem(
            identifier="reddit_candidate_1",
            heuristic_rank=1,
            subreddit_rank=1,
            post=RedditPost(
                subreddit="AskReddit",
                title="Remote work should be the default",
                url="https://www.reddit.com/r/AskReddit/comments/abc123/example/",
                comment_count=1234,
                upvote_ratio=0.61,
                raw_features={"log_comment_count": 7.119, "disagreement": 0.39},
                normalized_features={"normalized_comments": 0.95, "normalized_disagreement": 0.65},
                raw_score=2.776,
                normalized_score=0.86,
            ),
        )
        pipeline_mock.return_value = type(
            "Result",
            (),
            {
                "shortlist": [shortlist_item],
                "selected": [
                    type(
                        "Selection",
                        (),
                        {
                            "rank": 1,
                            "reason": "Broad, relatable, and easy to convert into a clean debate statement.",
                            "suggested_debate_statement": "Remote work should be the default for office jobs",
                            "suitability_score": 0.91,
                            "shortlist_item": shortlist_item,
                        },
                    )()
                ],
            },
        )()
        stdout = StringIO()

        call_command("inspect_reddit_pipeline", "--limit", "1", stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("Heuristic shortlist: 1 item(s)", output)
        self.assertIn("reddit_candidate_1 | r/AskReddit", output)
        self.assertIn("heuristic_score=0.860", output)
        self.assertIn("Final selection: 1 candidate(s)", output)
        self.assertIn("suitability=0.910", output)
        self.assertIn(
            "suggested_debate_statement=Remote work should be the default for office jobs",
            output,
        )
        self.assertIn("reason=Broad, relatable, and easy to convert into a clean debate statement.", output)
        self.assertIn("Remote work should be the default", output)
        self.assertIn("url=https://www.reddit.com/r/AskReddit/comments/abc123/example/", output)
        pipeline_mock.assert_called_once_with(
            selection_limit=1,
            per_subreddit_limit=25,
            subreddits=None,
            per_subreddit_rank_limit=3,
            shortlist_limit=20,
            listing="hot",
        )

    @patch("debate.management.commands.inspect_reddit_pipeline.build_reddit_shortlist")
    def test_management_command_can_print_shortlist_only(self, shortlist_mock):
        shortlist_mock.return_value = [
            RedditShortlistItem(
                identifier="reddit_candidate_1",
                heuristic_rank=1,
                subreddit_rank=1,
                post=RedditPost(
                    subreddit="changemyview",
                    title="A heuristic-only candidate",
                    url="https://example.com/cmv",
                    normalized_score=0.72,
                ),
            )
        ]
        stdout = StringIO()

        call_command("inspect_reddit_pipeline", "--shortlist-only", stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("Heuristic shortlist: 1 item(s)", output)
        self.assertIn("A heuristic-only candidate", output)
        self.assertNotIn("Final selection:", output)
        shortlist_mock.assert_called_once_with(
            per_subreddit_limit=25,
            subreddits=None,
            per_subreddit_rank_limit=3,
            listing="hot",
            shortlist_limit=20,
        )

    @override_settings(
        AUTO_DEBATE_DISCORD_WEBHOOK_URL="https://discord.example/webhook",
        AUTO_DEBATE_GENERATION_CANDIDATE_COUNT=3,
    )
    @patch("debate.tasks.review_notifications.urlopen")
    def test_discord_notification_failure_does_not_abort_batch(self, urlopen_mock):
        draft_debate = Debate.objects.create(
            title="Cities should restrict short-term rentals",
            description="Short-term rental restrictions may protect housing supply but reduce tourism income and owner flexibility.",
            hidden=True,
        )
        candidate = GeneratedDebateCandidate.objects.create(
            debate=draft_debate,
            short_description="Restrictions may ease housing pressure but limit property rights and visitor options.",
            status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        )
        urlopen_mock.side_effect = HTTPError(
            url="https://discord.example/webhook",
            code=403,
            msg="Forbidden",
            hdrs=None,
            fp=None,
        )

        sent_count = send_generated_debate_candidates_to_discord()

        self.assertEqual(sent_count, 0)
        candidate.refresh_from_db()
        self.assertIsNone(candidate.review_requested_at)


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
