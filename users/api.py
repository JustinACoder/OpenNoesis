from django.contrib.auth import get_user_model
from django.http import Http404
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError
from ninja.security import django_auth
from ninja import PatchDict

from ProjectOpenDebate.auth import optional_django_auth
from .schemas import PublicUserSchema, PrivateUserSchema, ProfileEditInputSchema

User = get_user_model()

# Initialize Ninja API router
router = Router(auth=django_auth)

@router.get("/{int:user_id}", response=PublicUserSchema, auth=optional_django_auth)
def get_public_user_profile(request, user_id: int):
    """
    Get user details by user ID.
    """
    return get_object_or_404(User, id=user_id)

@router.get("/me", response=PrivateUserSchema)
def get_private_user_profile(request):
    """
    Get the authenticated user's profile.
    """
    user = request.auth
    return get_object_or_404(User, id=user.id)


@router.patch("/me", response={204: None})
def update_private_user_profile(request, payload: PatchDict[ProfileEditInputSchema]):
    """
    Update the authenticated user's profile.
    """
    if len(payload.items()) == 0:
        raise HttpError(400, "No data provided for update.")

    user = request.auth
    user_profile = user.profile # We should always have a profile due to the signal

    for field, value in payload.items():
        setattr(user_profile, field, value)

    user_profile.save()

    return 204, None

