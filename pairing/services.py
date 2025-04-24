from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from debate.models import Debate
from pairing.models import PairingRequest

User = get_user_model()

def create_passive_pairing_request(user: User, debate_id: int, stance_wanted: int):
    """
    Create a passive pairing request for the given user.

    Retrurns True if the request was successfully created, False if the user has already
    requested a passive pairing for the same debate and stance.
    """
    if stance_wanted not in [-1, 1]:
        raise ValueError("Invalid stance_wanted value. Must be -1 or 1.")

    debate = get_object_or_404(Debate, id=debate_id)

    # Check if the user already has a similar pairing request
    if user.pairingrequest_set.filter(
            debate=debate,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=stance_wanted
    ).exists():
        return False

    # Create the pairing request
    PairingRequest.objects.create(
        user=user,
        debate=debate,
        status=PairingRequest.Status.PASSIVE,
        desired_stance=stance_wanted
    )
    return True