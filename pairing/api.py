from typing import Literal, Optional

from ninja import Router
from ninja.errors import HttpError
from ninja.security import django_auth

from .models import PairingRequest
from .schemas import PairingRequestSchema, PairingRequestInputSchema
from .services import create_passive_pairing_request

# Initialize Ninja API router
router = Router(auth=django_auth)

@router.post("/request-passive-pairing", response={204: None})
def request_passive_pairing(request, data: PairingRequestInputSchema):
    """
    Request passive pairing for the current user.
    """
    is_new_and_valid_request = create_passive_pairing_request(request.user, data.debate_id, data.desired_stance)
    if not is_new_and_valid_request:
        raise HttpError(400, "You already have a passive pairing request for this debate and stance.")
    return 204, None

@router.get("/current-active-pairing", response=Optional[PairingRequestSchema])
def get_current_active_pairing(request):
    return PairingRequest.objects.get_current_request(request.user)