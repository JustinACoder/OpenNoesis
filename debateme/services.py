from typing import Optional

from django.shortcuts import get_object_or_404
from django.db.models import Count, QuerySet
from django.db import transaction

from debate.models import Debate
from debateme.models import Invite, InviteUse
from discussion.views import create_discussion_and_readcheckpoints
from notifications.models import Notification


class DisallowedActionError(Exception):
    """Custom exception for disallowed actions."""
    pass

class InviteService:
    @classmethod
    def get_invites_queryset(cls) -> QuerySet[Invite]:
        """
        Retrieve all invites and select related debates and user.

        You can use the resulting queryset to filter, order, or annotate as needed.
        """
        return Invite.objects.select_related('debate', 'creator')

    @classmethod
    def get_invite_by_code(cls, invite_code: str) -> Optional[Invite]:
        """
        Retrieve an invite by its code.

        Throws an exception if the invite is not found.
        """
        return get_object_or_404(cls.get_invites_queryset(), code=invite_code)

    @classmethod
    def get_user_invites(cls, user) -> QuerySet[Invite]:
        """Retrieve all invites created by a user in order."""
        return cls.get_invites_queryset().filter(creator=user).order_by('-created_at')

    @classmethod
    @transaction.atomic
    def create_invite(cls, user, debate_slug: str) -> Invite:
        """Create a new invite for a specific debate."""
        debate = get_object_or_404(Debate, slug=debate_slug)
        return Invite.objects.create(creator=user, debate=debate)

    @classmethod
    @transaction.atomic
    def accept_invite(cls, invite_code: str, user) -> InviteUse:
        """
        Process invite acceptance.

        Args:
            invite_code (str): The unique invite code
            user: The user accepting the invite

        Returns:
            dict: A dictionary containing the discussion ID and a message
        """
        # Get the invite
        invite = cls.get_invite_by_code(invite_code)

        # Prevent invite creator from accepting their own invite
        if invite.creator == user:
            raise DisallowedActionError("Cannot accept your own invite")

        # Check if invite has already been used by this user
        has_already_used_invite = InviteUse.objects.filter(
            invite=invite,
            user=user
        ).exists()

        if has_already_used_invite:
            raise DisallowedActionError("Invite already accepted")

        # Create discussion
        participant1, participant2 = invite.creator, user
        discussion = create_discussion_and_readcheckpoints(invite.debate, participant1, participant2)

        # Create invite use record
        invite_use = InviteUse.objects.create(
            invite=invite,
            user=user,
            resulting_discussion=discussion
        )

        # Add discussion to participants' live list
        discussion.add_discussion_to_participants_list_live()

        # Create notification for invite creator
        Notification.objects.create_accepted_invite_notification(invite, invite_use, user)

        return invite_use

    @classmethod
    def delete_invite(cls, invite_code: str, user):
        """
        Delete an invite created by the user.

        Args:
            invite_code (str): The unique invite code
            user: The user attempting to delete the invite

        Returns:
            bool: Whether the invite was successfully deleted
        """
        deleted_count, deleted_info = Invite.objects.filter(
            code=invite_code,
            creator=user
        ).delete()

        return deleted_count > 0
