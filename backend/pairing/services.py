from __future__ import annotations
from typing import Literal, Tuple
from django.contrib.auth import get_user_model
from django.db import transaction, connection
from django.db.models import OuterRef, Subquery
from django.shortcuts import get_object_or_404
from debate.models import Debate, Stance
from pairing.models import PairingRequest, PairingMatch
from .tasks import complete_active_pairing_and_notify

User = get_user_model()


def create_passive_pairing_request(user: User, debate_id: int, desired_stance: Literal[-1, 1]) -> bool:
    """
    Create a passive pairing request for the given user.

    Returns True if the request was created, False if a similar request already exists.
    """
    debate = get_object_or_404(Debate, id=debate_id)

    # Check if the user already has a similar pairing request
    if user.pairingrequest_set.filter(
            debate=debate,
            status=PairingRequest.Status.PASSIVE,
            desired_stance=desired_stance
    ).exists():
        return False

    # Create the pairing request
    PairingRequest.objects.create(
        user=user,
        debate=debate,
        status=PairingRequest.Status.PASSIVE,
        desired_stance=desired_stance
    )
    return True

def create_active_pairing_request(user: User, debate_id: int, desired_stance: Literal[-1, 1]) -> bool:
    """
    Create an active pairing request for the given user.

    Returns True if the request was created and False if the user already has an active request.
    """
    debate = get_object_or_404(Debate, id=debate_id)

    # Check if the user already has an active (non-expired) pairing request
    if PairingRequest.objects.filter(
            user=user,
            debate=debate,
            status=PairingRequest.Status.ACTIVE,
            is_expired=False
    ).exists():
        return False

    # Create the pairing request
    pairing_request, pairing_match = request_match(user, debate, desired_stance)

    if pairing_match:
        # Inform the through websocket that a match was found
        # And prepare to complete the pairing process in 3 seconds
        pairing_match.notify_active_search_match_found()
        complete_active_pairing_and_notify.apply_async(
            args=[pairing_match.id],
            countdown=3 # Run after 3 seconds, it might be slightly after but that's fine
        )
    else:
        # Inform the through websocket that the request was created and is waiting
        # for a match
        pairing_request.notify_active_search_status("start_search")

    return True

@transaction.atomic
def request_match(user, debate, desired_stance) -> Tuple[PairingRequest, PairingMatch | None]:
    """
    Try to match the current user for `debate` with someone who:
      - wants the user's stance, and
      - themselves holds the stance the user desires.

    If a counterpart exists, create both requests (the current one and the existing one) as a match.
    Otherwise, enqueue the current user's request (ACTIVE) and return None.

    Concurrency: serialized per (debate, unordered{my_stance, desired_stance}) using pg_advisory_xact_lock.
    """
    my_stance = debate.get_stance(user)

    # ---- Per-key advisory lock ---------------------------------------------
    # Use an unordered pair of stances so both (A wants B) and (B wants A)
    # map to the same lock key for this debate.
    s1, s2 = sorted([str(my_stance), str(desired_stance)])
    lock_key = f"{debate.id}|{s1}|{s2}"

    # Transaction-scoped advisory lock: different keys don't block each other.
    # Use the 2-int variant to avoid bigint casting issues.
    with connection.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s), 0);", [lock_key])
    # ------------------------------------------------------------------------

    # Build a subquery to fetch the candidate's current stance
    other_user_stance = Subquery(
        Stance.objects
        .filter(debate=debate, user=OuterRef('user'))
        .values('stance')[:1]
    )

    # Under the per-key lock, just claim the oldest compatible ACTIVE request.
    # No need for id__lt/self-exclusion-by-id because we haven't inserted ours yet.
    candidate = (
        PairingRequest.objects
        .select_for_update(skip_locked=True)
        .annotate(other_user_stance=other_user_stance)
        .filter(
            status=PairingRequest.Status.ACTIVE,
            debate=debate,
            desired_stance=my_stance,        # they want my stance
            other_user_stance=desired_stance,  # they have the stance I want
            is_expired=False,
        )
        .exclude(user=user) # just in case
        .order_by('created_at', 'id')
        .first()
    )

    user_request = PairingRequest.objects.create(
        user=user,
        debate=debate,
        status=PairingRequest.Status.ACTIVE,
        desired_stance=desired_stance,
    )

    pairing_match = None
    if candidate:
        pairing_match = PairingMatch.objects.create_match_found(user_request, candidate)

    return user_request, pairing_match

@transaction.atomic
def cancel_pairing_request(user: User, pairing_request_id: int) -> bool:
    """
    Cancel a pairing request for the given user.

    Returns True if the request was cancelled, False if no such request exists.
    """
    with transaction.atomic():
        pairing_request = PairingRequest.objects.select_for_update().filter(
            id=pairing_request_id,
            user=user,
            is_matched=False
        ).first()

        if not pairing_request:
            return False

        # Notify the user that the pairing request has been cancelled if it is active (passive requests dont need live updates)
        if pairing_request.status == PairingRequest.Status.ACTIVE:
            pairing_request.notify_active_search_cancelled()

        # Delete the pairing request
        pairing_request.delete()

    return True