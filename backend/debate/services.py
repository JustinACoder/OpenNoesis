from django.contrib.auth import get_user_model
from django.db.models import QuerySet, F
from django.db.models.functions import Length, Trim
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import AnonymousUser
from ninja.files import UploadedFile

from pairing.models import PairingRequest
from .image_uploads import DebateImageUploadService
from .models import Debate, Comment, Vote
from .querysets import DebateQuerySet, CommentQuerySet
from .schemas import VoteDirectionEnum, StanceDirectionEnum

User = get_user_model()


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
        return Debate.objects.get_queryset().with_votes(user).with_stance(user).with_user_requests(user).select_related('author')

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
            DebateService.get_debate_queryset(user),
            **debate_identifier
        )

    @staticmethod
    def create_debate(
        user: User,
        title: str,
        description: str,
        image: UploadedFile | None = None,
    ) -> Debate:
        """Create a new debate authored by the authenticated user."""
        prepared_image = DebateImageUploadService.prepare_image(image)
        return Debate.objects.create(
            title=title.strip(),
            description=description.strip(),
            author=user,
            image=prepared_image,
        )

    @staticmethod
    def get_user_debates(user: User) -> DebateQuerySet:
        """Retrieve debates created by the authenticated user."""
        return DebateService.get_debate_queryset(user).filter(author=user).get_recent()

    @staticmethod
    def update_debate(
        *,
        user: User,
        debate_slug: str,
        title: str,
        description: str,
        image: UploadedFile | None = None,
        remove_image: bool = False,
    ) -> Debate:
        """Update a debate owned by the authenticated user."""
        debate = get_object_or_404(
            Debate,
            slug=debate_slug,
            author=user,
        )

        original_image = debate.image
        prepared_image = None

        debate.title = title.strip()
        debate.description = description.strip()

        if remove_image:
            debate.image = None
        elif image is not None:
            prepared_image = DebateImageUploadService.prepare_image(image)
            debate.image = prepared_image

        debate.save()

        should_delete_original_image = bool(
            original_image
            and (
                remove_image
                or (
                    prepared_image is not None
                    and original_image.name != debate.image.name
                )
            )
        )

        if should_delete_original_image:
            original_image.delete(save=False)

        return DebateService.get_debate_details(user, debate_id=debate.id)

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
        # Get the comments for the debate
        return CommentService.get_comments_queryset(user).filter(debate__slug=debate_slug).order_by('-date_added')


class StanceService:
    @staticmethod
    def set_stance(user, debate_slug: str, stance: StanceDirectionEnum) -> None:
        """Set a user's stance on a debate."""
        debate = get_object_or_404(Debate, slug=debate_slug)

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
        debate = get_object_or_404(Debate, slug=debate_slug)

        # Record the vote
        Vote.objects.record_vote(debate, user, direction)

    @staticmethod
    def vote_on_comment(user, comment_id: int, direction: VoteDirectionEnum) -> None:
        """Register a vote on a comment."""
        comment = get_object_or_404(Comment, pk=comment_id)

        # Record the vote
        Vote.objects.record_vote(comment, user, direction)
