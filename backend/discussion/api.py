from typing import List, Literal, Optional

from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.pagination import paginate
from ninja.security import django_auth

from ProjectOpenDebate.common.utils import CursorPagination
from discussion.schemas import MessageSchema, DiscussionSchema, ReadCheckpointSchema, ArchiveStatusInputSchema
from discussion.services import DiscussionService

# Initialize Ninja API
router = Router(auth=django_auth)

# API Endpoints
@router.get("", response=List[DiscussionSchema])
@paginate(CursorPagination, cursor_type="date+id", date_field="latest_activity")
def get_discussions(request, filterType: Optional[Literal["active", "archived"]] = None):
    """
    Get the most recent discussions for the current user.
    """
    return DiscussionService.get_discussions_for_user(request.auth, filterType)


@router.get("/most-recent", response=DiscussionSchema)
def get_most_recent_discussion(request):
    """
    Get the most recent active discussion for the current user.
    """
    discussion = DiscussionService.get_discussions_for_user(request.auth, 'active').first()
    if not discussion:
        return router.api.create_response(request, {"detail": "No active discussions found"}, status=404)

    return discussion


@router.get("/{int:discussion_id}", response=DiscussionSchema)
def get_discussion(request, discussion_id: int):
    """
    Get a specific discussion.
    """
    return get_object_or_404(DiscussionService.get_discussions_for_user(request.auth), pk=discussion_id)


@router.get("/{int:discussion_id}/messages", response=List[MessageSchema])
@paginate(CursorPagination)
def get_discussion_messages(request, discussion_id: int):
    """
    Get messages for a specific discussion.
    """
    return DiscussionService.get_discussion_messages(discussion_id, request.auth)


@router.patch("/{int:discussion_id}/archive", response={204: None})
def set_discussion_archive_status(request, discussion_id: int, status_data: ArchiveStatusInputSchema):
    """
    Archive or unarchive a discussion.
    """
    DiscussionService.set_discussion_archive_status(discussion_id, request.auth, status_data.status)
    return 204, None


@router.get("/{int:discussion_id}/readcheckpoints", response=List[ReadCheckpointSchema])
def get_read_checkpoints(request, discussion_id: int):
    """
    Get the read checkpoints for a discussion.
    """
    return DiscussionService.get_read_checkpoints(discussion_id, request.auth)

@router.get("/unread-count", response=int)
def get_messages_unread_count(request):
    """
    Get count of unread messages for the current user.
    """
    return DiscussionService.get_unread_count(request.auth)

@router.get("/{int:discussion_id}/unread-count", response=int)
def get_unread_count_for_discussion(request, discussion_id: int):
    """
    Get count of unread messages for a specific discussion.
    """
    return DiscussionService.get_unread_count(request.auth, discussion_id)
