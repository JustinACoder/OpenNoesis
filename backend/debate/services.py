from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from pairing.models import PairingRequest
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
    def create_debate(user: User, title: str, description: str) -> Debate:
        """Create a new debate authored by the authenticated user."""
        return Debate.objects.create(
            title=title.strip(),
            description=description.strip(),
            author=user,
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
