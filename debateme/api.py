from typing import List

from ninja import Router
from ninja.pagination import paginate, PageNumberPagination
from ninja.security import django_auth
from ninja.errors import HttpError
from django.http import Http404

from .schemas import InviteSchema, InviteUseSchema
from .services import InviteService, DisallowedActionError

router = Router(auth=django_auth)


@router.get("", response=List[InviteSchema])
@paginate(PageNumberPagination, page_size=15)
def list_invites(request):
    """
    List all invites created by the authenticated user.
    """
    user = request.auth or request.user
    return InviteService.get_user_invites(user)


@router.post("", response=InviteSchema)
def create_invite(request, debate_slug: str):
    """
    Create a new invite for a specific debate.
    """
    user = request.auth or request.user
    return InviteService.create_invite(user, debate_slug)


@router.get("/{invite_code}", response=InviteSchema, auth=None)
def view_invite(request, invite_code: str):
    """
    View details of a specific invite.
    """
    return InviteService.get_invite_by_code(invite_code)


@router.post("/{invite_code}/accept", response=InviteUseSchema)
def accept_invite(request, invite_code: str):
    """
    Accept an invite and start a discussion.
    """
    user = request.auth or request.user
    try:
        return InviteService.accept_invite(invite_code, user)
    except DisallowedActionError as e:
        message = str(e) or "An error occurred"
        raise HttpError(403, message)


@router.delete("/{invite_code}", response={204: None})
def delete_invite(request, invite_code: str):
    """
    Delete an invite created by the authenticated user.
    """
    user = request.auth or request.user
    is_deleted = InviteService.delete_invite(invite_code, user)
    if not is_deleted:
        raise Http404("Invite not found or you do not have permission to delete it.")

    return 204, None
