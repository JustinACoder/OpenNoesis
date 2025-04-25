from typing import List

from django.contrib.auth import get_user_model
from django.http import Http404
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.pagination import paginate, PageNumberPagination
from ninja.security import django_auth
from ninja import PatchDict
from .schemas import PublicUserSchema, PrivateUserSchema, ProfileEditSchema

User = get_user_model()

# Initialize Ninja API router
router = Router(auth=django_auth)

@router.get("/{int:user_id}", response=PublicUserSchema, auth=None)
@paginate(PageNumberPagination, page_size=15)
def get_public_user_profile(request, user_id: int):
    """
    Get user details by user ID.
    """
    return get_object_or_404(User, user_id=user_id)

@router.get("/me", response=PrivateUserSchema)
def get_private_user_profile(request):
    """
    Get the authenticated user's profile.
    """
    user = request.auth or request.user
    return get_object_or_404(User, id=user.id)


@router.patch("/me", response={204: None})
def update_private_user_profile(request, payload: PatchDict[ProfileEditSchema]):
    """
    Update the authenticated user's profile.
    """
    if len(payload) == 0:
        raise Http404("No data provided for update.")

    user = request.auth or request.user
    user_profile = user.profile # We should always have a profile due to the signal

    for field, value in payload.items():
        setattr(user_profile, field, value)

    user_profile.save()

    return 204, None

