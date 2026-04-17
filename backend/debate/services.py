import logging
import re
from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db.models import QuerySet, F
from django.db.models.functions import Length, Trim
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import AnonymousUser
from ninja.files import UploadedFile
from django.utils import timezone

from pairing.models import PairingRequest
from .generated_images import GeneratedDebateCoverError, GeneratedDebateCoverService
from .image_uploads import DebateImageUploadService
from .models import Debate, Comment, Vote, GeneratedDebateCandidate
from .querysets import DebateQuerySet, CommentQuerySet
from .schemas import VoteDirectionEnum, StanceDirectionEnum

User = get_user_model()
logger = logging.getLogger(__name__)


class DebateService:
    @staticmethod
    def get_debate_queryset(user: User) -> DebateQuerySet:
        """
        General method to retrieve the debate queryset with the necessary select_related and annotations.
        It is meant to be further filtered by the calling method. The output is an unevaluated queryset
        that fits the DebateSchema.
        :param user: User object to which we check the votes, stance and requests
        :return: QuerySet[Debate]
        """
        return (
            Debate.objects.get_queryset()
            .public()
            .with_votes(user)
            .with_stance(user)
            .with_user_requests(user)
            .select_related('author')
        )

    @staticmethod
    def get_direct_access_debate_queryset(user: User) -> DebateQuerySet:
        queryset = Debate.objects.get_queryset()
        if not getattr(user, "is_staff", False):
            queryset = queryset.public()

        return (
            queryset
            .with_votes(user)
            .with_stance(user)
            .with_user_requests(user)
            .select_related('author')
        )

    @staticmethod
    def get_debate_details(user, debate_id: int = None, debate_slug: str = None) -> Debate:
        """Get detailed information about a debate."""
        if debate_id is None and debate_slug is None:
            raise ValueError("Either debate_id or debate_slug must be provided.")
        elif debate_id is not None and debate_slug is not None:
            raise ValueError("Only one of debate_id or debate_slug must be provided.")

        # Define debate identifier
        debate_identifier = {'pk': debate_id} if debate_id is not None else {'slug': debate_slug}

        return get_object_or_404(
            DebateService.get_direct_access_debate_queryset(user),
            **debate_identifier
        )

    @staticmethod
    def create_debate(
        user: User,
        title: str,
        description: str,
        image: UploadedFile | None = None,
        prepared_image: ContentFile | None = None,
    ) -> Debate:
        """Create a new debate authored by the authenticated user."""
        if image is not None and prepared_image is not None:
            raise ValueError("Only one of image or prepared_image may be provided.")

        if prepared_image is None:
            prepared_image = DebateImageUploadService.prepare_image(image)

        return Debate.objects.create(
            title=title.strip(),
            description=description.strip(),
            author=user,
            image=prepared_image,
        )

    @staticmethod
    def get_sitemap_debates(limit: int = 2000):
        """
        Return debates eligible for sitemap indexing.

        Inclusion rules:
        - Description has at least ~200 words (approximated with character count)
        Ordered by total stances descending.
        """
        if limit <= 0:
            return Debate.objects.none()
        limit = min(limit, 2000)
        minimum_description_characters = 1200

        return (
            Debate.objects.get_queryset()
            .with_stance(AnonymousUser())
            .annotate(total_stances=F('num_for') + F('num_against'))
            .annotate(description_length=Length(Trim(F('description'))))
            .filter(
                description_length__gte=minimum_description_characters,
            )
            .order_by('-total_stances', '-date')
            .values('slug', 'date', 'total_stances')[:limit]
        )

    @staticmethod
    def get_featured_debate(user: User, *, target_date: date | None = None) -> Debate | None:
        target_date = target_date or timezone.localdate()
        return (
            DebateService.get_debate_queryset(user)
            .filter(featured_on=target_date)
            .order_by("-date")
            .first()
        )

class CommentService:
    @staticmethod
    def get_comments_queryset(user: User) -> CommentQuerySet:
        """
        General method to retrieve the comments queryset with the necessary select_related and annotations.
        It is meant to be further filtered by the calling method. The output is an unevaluated queryset
        that fits the CommentSchema.
        :param user: User object to which we check the votes
        :return: QuerySet[Comment]
        """
        return Comment.objects.get_queryset().with_votes(user).select_related('author')

    @staticmethod
    def create_comment(user, debate_id: int, text: str) -> Comment:
        """Create a new comment."""
        return Comment.objects.create(
            debate_id=debate_id,
            author=user,
            text=text
        )

    @staticmethod
    def list_debate_comments(user, debate_slug: str) -> QuerySet[Comment]:
        debate = DebateService.get_debate_details(user, debate_slug=debate_slug)
        return CommentService.get_comments_queryset(user).filter(debate=debate).order_by('-date_added')


class StanceService:
    @staticmethod
    def set_stance(user, debate_slug: str, stance: StanceDirectionEnum) -> None:
        """Set a user's stance on a debate."""
        debate = get_object_or_404(Debate.objects.get_queryset().public(), slug=debate_slug)

        # Update the user's stance on the debate
        if stance == StanceDirectionEnum.UNSET:
            debate.stance_set.filter(user=user).delete()
        else:
            debate.stance_set.update_or_create(user=user, defaults={'stance': stance})

        # Delete any pending pairing requests for the user on this debate
        PairingRequest.objects.filter(
            user=user,
            debate=debate,
            is_matched=False
        ).delete()

class VoteService:
    @staticmethod
    def vote_on_debate(user, debate_slug: str, direction: VoteDirectionEnum) -> None:
        """Register a vote on a debate."""
        debate = get_object_or_404(Debate.objects.get_queryset().public(), slug=debate_slug)

        # Record the vote
        Vote.objects.record_vote(debate, user, direction)

    @staticmethod
    def vote_on_comment(user, comment_id: int, direction: VoteDirectionEnum) -> None:
        """Register a vote on a comment."""
        comment = get_object_or_404(Comment, pk=comment_id)

        # Record the vote
        Vote.objects.record_vote(comment, user, direction)


class GeneratedDebateCandidateService:
    MUTABLE_REDISCOVERY_STATES = {
        GeneratedDebateCandidate.Status.DISCOVERED,
        GeneratedDebateCandidate.Status.NEEDS_REVIEW,
        GeneratedDebateCandidate.Status.FAILED,
    }

    @staticmethod
    def normalize_title(title: str) -> str:
        normalized = re.sub(r"\s+", " ", title).strip().lower()
        return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:120]

    @staticmethod
    def clean_generated_title(title: str) -> str:
        max_length = Debate._meta.get_field("title").max_length
        cleaned = re.sub(r"\s+", " ", title).strip()
        if len(cleaned) <= max_length:
            return cleaned

        truncated = cleaned[: max_length - 1].rstrip(" ,:;-/")
        return f"{truncated}…"

    @staticmethod
    def find_similar_debates(title: str, limit: int = 5) -> list[dict]:
        query = title.strip()
        if not query:
            return []

        similar_debates = Debate.objects.get_queryset().public().search(query)[:limit]
        return [
            {
                "id": debate.id,
                "slug": debate.slug,
                "title": debate.title,
            }
            for debate in similar_debates
        ]

    @staticmethod
    def create_or_update_candidate(
        *,
        title: str,
        short_description: str,
        generated_description: str = "",
        source_payload: dict | None = None,
    ) -> GeneratedDebateCandidate | None:
        if not GeneratedDebateCandidateService.normalize_title(title):
            return None

        cleaned_title = GeneratedDebateCandidateService.clean_generated_title(title)
        if not cleaned_title:
            return None
        if Debate.objects.filter(title__iexact=title.strip(), hidden=False).exists():
            logger.info("Skipping generated candidate because debate already exists: %s", title)
            return None

        similarity_payload = GeneratedDebateCandidateService.find_similar_debates(title)
        candidate = (
            GeneratedDebateCandidate.objects
            .select_related("debate")
            .filter(debate__title__iexact=cleaned_title)
            .first()
        )

        if candidate is None:
            debate = Debate.objects.create(
                title=cleaned_title,
                description=generated_description.strip() or short_description.strip(),
                author=None,
                hidden=True,
            )
            candidate = GeneratedDebateCandidate.objects.create(
                debate=debate,
                short_description=short_description.strip(),
                source_payload=source_payload or {},
                similarity_payload=similarity_payload,
                status=GeneratedDebateCandidate.Status.NEEDS_REVIEW,
            )
            return candidate

        candidate.debate.title = cleaned_title
        candidate.debate.description = generated_description.strip() or short_description.strip()
        candidate.debate.save(update_fields=["title", "description"])
        candidate.short_description = short_description.strip()
        candidate.source_payload = source_payload or {}
        candidate.similarity_payload = similarity_payload
        if candidate.status in GeneratedDebateCandidateService.MUTABLE_REDISCOVERY_STATES:
            candidate.status = GeneratedDebateCandidate.Status.NEEDS_REVIEW
        candidate.save(
            update_fields=[
                "short_description",
                "source_payload",
                "similarity_payload",
                "status",
                "updated_at",
            ]
        )
        return candidate

    @staticmethod
    def approve_candidate(candidate: GeneratedDebateCandidate, reviewer_notes: str = "") -> GeneratedDebateCandidate:
        candidate.approved_at = timezone.now()
        candidate.rejected_at = None
        if reviewer_notes:
            candidate.reviewer_notes = reviewer_notes.strip()
        candidate.save(update_fields=["approved_at", "rejected_at", "reviewer_notes", "updated_at"])
        try:
            GeneratedDebateCandidateService.publish_candidate(candidate)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to publish approved candidate %s", candidate.pk)
            GeneratedDebateCandidateService.mark_failed(
                candidate,
                note=f"Publishing failed after approval: {exc}",
            )
        candidate.refresh_from_db()
        return candidate

    @staticmethod
    def reject_candidate(candidate: GeneratedDebateCandidate, reviewer_notes: str = "") -> GeneratedDebateCandidate:
        candidate.status = GeneratedDebateCandidate.Status.REJECTED
        candidate.rejected_at = timezone.now()
        candidate.approved_at = None
        if reviewer_notes:
            candidate.reviewer_notes = reviewer_notes.strip()
        candidate.save(update_fields=["status", "rejected_at", "approved_at", "reviewer_notes", "updated_at"])
        return candidate

    @staticmethod
    def mark_failed(candidate: GeneratedDebateCandidate, *, note: str) -> GeneratedDebateCandidate:
        candidate.status = GeneratedDebateCandidate.Status.FAILED
        candidate.reviewer_notes = note.strip()
        candidate.save(update_fields=["status", "reviewer_notes", "updated_at"])
        return candidate

    @staticmethod
    def generate_cover_image(candidate: GeneratedDebateCandidate) -> GeneratedDebateCandidate:
        result = GeneratedDebateCoverService.generate_cover(
            title=candidate.debate.title
        )
        candidate.debate.image.save(result.image.name, result.image, save=False)
        candidate.debate.save(update_fields=["image"])
        candidate.cover_image_reasoning = result.reasoning
        candidate.cover_image_generation_error = ""
        candidate.cover_image_generated_at = timezone.now()
        candidate.save(
            update_fields=[
                "cover_image_reasoning",
                "cover_image_generation_error",
                "cover_image_generated_at",
                "updated_at",
            ]
        )
        return candidate

    @staticmethod
    def try_generate_cover_image(candidate: GeneratedDebateCandidate) -> GeneratedDebateCandidate:
        try:
            return GeneratedDebateCandidateService.generate_cover_image(candidate)
        except GeneratedDebateCoverError as exc:
            logger.warning("Unable to generate cover image for candidate %s: %s", candidate.pk, exc)
            candidate.cover_image_generation_error = str(exc)
            candidate.save(update_fields=["cover_image_generation_error", "updated_at"])
            return candidate

    @staticmethod
    def publish_candidate(candidate: GeneratedDebateCandidate) -> Debate:
        debate = candidate.debate
        if not debate.hidden:
            return debate

        debate.hidden = False
        debate.featured_on = timezone.localdate()
        debate.save(update_fields=["hidden", "featured_on"])
        candidate.status = GeneratedDebateCandidate.Status.PUBLISHED
        candidate.published_at = timezone.now()
        candidate.save(update_fields=["status", "published_at", "updated_at"])
        return debate

    @staticmethod
    def build_review_payload(candidate: GeneratedDebateCandidate) -> str:
        similarity_lines = []
        for similar in candidate.similarity_payload[:3]:
            similarity_lines.append(
                f"- {similar['title']} (/d/{similar['slug']})"
            )

        lines = [
            f"Candidate: {candidate.debate.title}",
            "",
            "Summary:",
            candidate.short_description,
        ]

        if similarity_lines:
            lines.extend([
                "",
                "Similar debates already on OpenNoesis:",
                *similarity_lines,
            ])

        source_links = [
            source.get("link")
            for source in candidate.source_payload.get("sources", [])
            if source.get("link")
        ]
        if source_links:
            lines.extend([
                "",
                "Source links:",
                *[f"- {link}" for link in source_links[:5]],
            ])

        return "\n".join(lines)
