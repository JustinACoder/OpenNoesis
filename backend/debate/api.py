from typing import List

from django.db.models import Q
from ninja import Router
from ninja.pagination import PageNumberPagination, paginate
from ninja.security import django_auth
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from ProjectOpenDebate.auth import optional_django_auth
from .models import Debate
from .schemas import (
    DebateSchema,
    CommentSchema,
    StanceSchema,
    StanceDirectionEnum, DebateFullSchema,
    CommentInputSchema, VoteInputSchema, StanceInputSchema,
)
from .services import (
    DebateService,
    CommentService,
    StanceService,
    VoteService
)

User = get_user_model()
router = Router(auth=optional_django_auth)


@router.get("/trending", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def trending_debates(request):
    """Get trending debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_trending()
    
@router.get("/popular", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def popular_debates(request):
    """Get popular debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_popular()

@router.get("/recent", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def recent_debates(request):
    """Get recent debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_recent()

@router.get("/controversial", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def controversial_debates(request):
    """Get controversial debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_controversial()

@router.get("/random", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def random_debates(request):
    """Get random debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_random()

@router.get("/search", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=25)
def search_debates(request, query: str):
    """Search for debates."""
    user = request.auth
    return DebateService.get_debate_queryset(user).search(query)


@router.get("/slug/{slug:debate_slug}", response=DebateFullSchema)
def get_debate(request, debate_slug: str):
    """Get detailed information about a debate."""
    user = request.auth
    return DebateService.get_debate_details(user, debate_slug=debate_slug)

@router.get("/with-user-stance", response=List[DebateSchema], auth=django_auth)
@paginate(PageNumberPagination, page_size=10)
def get_debates_with_user_stance(request):
    """Get debates with the user's stance."""
    user = request.auth
    return DebateService.get_debate_queryset(user).filter(~Q(user_stance=StanceDirectionEnum.UNSET))


@router.get("/slug/{slug:debate_slug}/suggestions", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def get_debate_suggestions(request, debate_slug: str):
    """Get suggested debates based on the current debate."""
    user = request.auth
    return DebateService.get_debate_queryset(user).get_random().exclude(slug=debate_slug)


@router.patch("/slug/{slug:debate_slug}/stance", response={204: None}, auth=django_auth)
def set_stance(request, debate_slug: str, stance_data: StanceInputSchema):
    """Set a user's stance on a debate."""
    user = request.auth
    StanceService.set_stance(user, debate_slug, stance_data.stance)
    return 204, None


@router.get("/slug/{slug:debate_slug}/comments", response=List[CommentSchema])
@paginate(PageNumberPagination, page_size=10)
def get_debate_comments(request, debate_slug: str):
    """Get paginated comments for a debate."""
    user = request.auth
    return CommentService.list_debate_comments(user, debate_slug)


@router.post("/slug/{slug:debate_slug}/comment", response=CommentSchema, auth=django_auth)
def create_comment(request, debate_slug: str, comment_data: CommentInputSchema):
    """Create a new comment for a debate."""
    user = request.auth
    # Check that the debate exists
    debate = get_object_or_404(Debate, slug=debate_slug)
    return CommentService.create_comment(user, debate.id, comment_data.text)


@router.patch("/slug/{slug:debate_slug}/vote", response={204: None}, auth=django_auth)
def vote_on_debate(request, debate_slug: str, vote_data: VoteInputSchema):
    """Register a vote on a debate."""
    user = request.auth
    VoteService.vote_on_debate(user, debate_slug, vote_data.direction)
    return 204, None


@router.patch("/slug/{slug:debate_slug}/comments/{comment_id}/vote", response={204: None}, auth=django_auth)
def vote_on_comment(request, debate_slug: str, comment_id: int, vote_data: VoteInputSchema):
    """Register a vote on a comment."""
    user = request.auth
    VoteService.vote_on_comment(user, comment_id, vote_data.direction)
    return 204, None
