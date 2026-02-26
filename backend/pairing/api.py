from typing import Optional

from ninja import Router
from ninja.errors import HttpError
from ninja.security import django_auth

from .models import PairingRequest
from .schemas import PairingRequestInputSchema, CurrentActivePairingRequest
from .services import create_passive_pairing_request, create_active_pairing_request, cancel_pairing_request

# Initialize Ninja API router
router = Router(auth=django_auth)

@router.post("/request", response={204: None})
def request_pairing(request, data: PairingRequestInputSchema):
    """
    Request pairing for the current user.
    """
    if data.pairing_type == 'active':
        is_request_processed = create_active_pairing_request(request.user, data.debate_id, data.desired_stance)
        if not is_request_processed:
            raise HttpError(400, "You already have an active pairing request.")
    else: # data.pairing_type == 'passive'
        is_request_processed = create_passive_pairing_request(request.user, data.debate_id, data.desired_stance)
        if not is_request_processed:
            raise HttpError(400, "You already have a passive pairing request for this debate and stance.")
    return 204, None

@router.post("/cancel/{int:pairing_request_id}", response={204: None})
def cancel_pairing(request, pairing_request_id: int):
    """
    Cancel a pairing request for the current user.
    """
    has_found_and_cancelled = cancel_pairing_request(request.user, pairing_request_id)
    if not has_found_and_cancelled:
        raise HttpError(404, "No cancellable pairing request found.")
    return 204, None

@router.get("/current-active-pairing", response=Optional[CurrentActivePairingRequest])
def get_current_active_pairing(request):
    return PairingRequest.objects.get_current_request(request.user)