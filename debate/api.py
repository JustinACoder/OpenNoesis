from typing import List
from ninja import Router
from ninja.pagination import PageNumberPagination, paginate
from ninja.security import django_auth
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from .models import Debate
from .schemas import (
    DebateSchema,
    CommentSchema,
    StanceSchema,
    VoteDirectionEnum, ExploreDebateListSchema,
)
from .services import (
    DebateService,
    CommentService,
    StanceService,
    VoteService
)

User = get_user_model()
router_base = Router()
router_debate = Router()


@router_base.get("/explore", response=ExploreDebateListSchema)
def explore_debates(request):
    """Get different categories of debates."""
    user = request.auth or request.user
    base_queryset = DebateService.get_debate_queryset(user)

    return ExploreDebateListSchema(
        trending=base_queryset.get_trending(),
        popular=base_queryset.get_popular(),
        recent=base_queryset.get_recent(),
        controversial=base_queryset.get_controversial(),
        random=base_queryset.get_random(),
    )


@router_debate.get("/search", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=25)
def search_debates(request, query: str):
    """Search for debates."""
    user = request.auth or request.user
    return DebateService.get_debate_queryset(user).search(query)


@router_debate.get("/{slug}", response=DebateSchema)
def get_debate(request, slug: str):
    """Get detailed information about a debate."""
    user = request.auth or request.user
    return DebateService.get_debate_details(user, debate_slug=slug)


@router_debate.get("/{slug}/suggestions", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def get_debate_suggestions(request, slug: str):
    """Get suggested debates based on the current debate."""
    user = request.auth or request.user
    return DebateService.get_debate_queryset(user).get_random().exclude(slug=slug)


@router_debate.post("/{slug}/stance", response=StanceSchema, auth=django_auth)
def set_stance(request, slug: str, stance_data: StanceSchema):
    """Set a user's stance on a debate."""
    user = request.auth or request.user
    debate_id = get_object_or_404(Debate, slug=slug).id
    return StanceService.set_stance(user, debate_id, stance_data.stance)


@router_debate.get("/{slug}/comments", response=List[CommentSchema])
@paginate(PageNumberPagination, page_size=10)
def get_debate_comments(request, slug: str):
    """Get paginated comments for a debate."""
    user = request.auth or request.user
    return CommentService.list_debate_comments(user, debate_slug=slug)


@router_debate.post("/{slug}/comments", response=CommentSchema, auth=django_auth)
def create_comment(request, slug: str, text: str):
    """Create a new comment for a debate."""
    user = request.auth or request.user
    debate_id = get_object_or_404(Debate, slug=slug).id
    return CommentService.create_comment(user, debate_id, text)


@router_debate.get("/{slug}/vote", response={204: None}, auth=django_auth)
def vote_on_debate(request, slug: str, direction: VoteDirectionEnum):
    """Register a vote on a debate."""
    user = request.auth or request.user
    debate_id = get_object_or_404(Debate, slug=slug).id
    VoteService.vote_on_debate(user, debate_id, direction)


@router_debate.post("/{slug}/comments/{comment_id}/vote", response={204: None}, auth=django_auth)
def vote_on_comment(request, slug: str, comment_id: int, direction: VoteDirectionEnum):
    """Register a vote on a comment."""
    user = request.auth or request.user
    VoteService.vote_on_comment(user, comment_id, direction)
