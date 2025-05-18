import asyncio
from pydantic import ValidationError

from ProjectOpenDebate.consumers import CustomBaseConsumer, atomic_async
from debate.models import Debate
from pairing.models import PairingRequest, PairingMatch
from .schemas import PairingRequestInputSchema
from channels.db import database_sync_to_async


class NoCurrentPairingRequestException(Exception):
    def __init__(self, user):
        self.user = user
        super().__init__(f'No current pairing request')


class PairingRequestAlreadyExistsException(Exception):
    def __init__(self, user):
        self.user = user
        super().__init__(f'You already have an active pairing request. Cancel it before creating a new one.')


class PairingConsumer(CustomBaseConsumer):
    """
    This consumer handles the WebSocket connection for pairing users together.
    """
    event_handlers = {
        'request_pairing': 'handle_request_pairing',
        'start_search': 'handle_start_search',
        'cancel': 'handle_cancel',
        'keepalive': 'handle_keepalive',
    }

    async def handle_keepalive(self, data):
        """
        Handles keepalive messages to maintain the connection.
        """
        user = self.scope['user']
        pairing_request = await self._get_current_request(user)

        if not pairing_request:
            await self.send_error('No active pairing request', no_toast=True, event_type='keepalive_ack')
            return

        await self._update_keepalive(pairing_request)
        await self.send_success('keepalive_ack')

    async def handle_start_search(self, data):
        """
        Handles starting the active search for a pairing request.
        """
        user = self.scope['user']

        try:
            pairing_request, best_match, pairing_match = await self._create_pairing_match_or_fail(user)
        except NoCurrentPairingRequestException as e:
            await self.send_error(str(e))
            return

        if not pairing_match:
            await self._notify_start_search(pairing_request)
        else:
            await self._notify_match_found(pairing_request, best_match)

            # Wait a few seconds before completing the pairing
            # We do not await to avoid blocking the event loop
            _ = asyncio.create_task(self._wait_then_complete_pairing(pairing_match))

    async def handle_cancel(self, data):
        """
        Handles cancelling a pairing request.
        """
        user = self.scope['user']

        try:
            deleted_pairing_request = await self._cancel_pairing_request_or_fail(user)
        except NoCurrentPairingRequestException as e:
            await self.send_error(str(e))
            return

        # Notify the users that the pairing request has been cancelled
        await self._notify_cancelled(deleted_pairing_request, user_id=deleted_pairing_request.user_id)

    async def handle_request_pairing(self, data):
        """
        Handles creating a pairing request.
        """
        try:
            payload = PairingRequestInputSchema(**data)
        except ValidationError as e:
            return await self.send_error('Invalid payload', details=e.errors())

        user = self.scope['user']

        try:
            debate = await Debate.objects.aget(id=payload.debate_id)
        except Debate.DoesNotExist:
            return await self.send_error('Debate does not exist')

        try:
            pairing_request = await self._create_pairing_request_or_fail(
                user, debate, payload.desired_stance
            )
        except PairingRequestAlreadyExistsException as e:
            await self.send_error(str(e))
            return

        # Notify the user that the pairing request has been created
        await self._notify_request_pairing(pairing_request)

    @atomic_async
    def _complete_match(self, pairing_match: PairingMatch):
        """
        Completes the pairing match by creating the related discussion.
        """
        return pairing_match.complete_match()

    async def _wait_then_complete_pairing(self, pairing_match: PairingMatch):
        """
        Waits for a few seconds before completing the pairing.
        """
        await asyncio.sleep(3.5)
        await self._complete_match(pairing_match)
        await self._notify_paired(pairing_match)

    @database_sync_to_async
    def _get_current_request(self, user):
        """
        Gets the current pairing request for a user.
        """
        return PairingRequest.objects.get_current_request(user)

    @database_sync_to_async
    def _update_keepalive(self, pairing_request):
        """
        Updates the keepalive timestamp of a pairing request.
        """
        pairing_request.update_keepalive()

    @atomic_async
    def _create_pairing_match_or_fail(self, user):
        """
        Creates a pairing match between the two pairing requests.
        """
        # Retrieve and lock the pairing request
        pairing_request = PairingRequest.objects.get_current_request(user, for_update=True)

        if not pairing_request or pairing_request.status != PairingRequest.Status.IDLE:
            raise NoCurrentPairingRequestException(user)

        # Mark the pairing request as active
        # TODO: is this really necessary?
        pairing_request.switch_status(PairingRequest.Status.ACTIVE)

        # Get the best match for the pairing request
        best_match = PairingRequest.objects.get_best_match(pairing_request, for_update=True)

        # According to the postgresql documentation,
        # "[...] rows that satisfied the query conditions as of the query snapshot will be locked,
        #  although they will not be returned if they were updated after the snapshot and no longer
        #  satisfy the query conditions"
        # This means that we are guaranteed that the best match is still a valid match if we can retrieve it.
        # Source: https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE

        if not best_match:
            return pairing_request, None, None

        # Create the pairing match
        pairing_match = PairingMatch.objects.create_match_found(pairing_request, best_match)

        return pairing_request, best_match, pairing_match

    async def _notify_start_search(self, pairing_request):
        """
        Notifies the user that the active search has started.
        """
        await self.send_event(
            pairing_request.user_id,
            'start_search'
        )

    async def _notify_match_found(self, pairing_request, best_match):
        """
        Notifies the two users that a match has been found and pairs them together.
        """
        # Notify the users that a match has been found
        for _pairing_request in [pairing_request, best_match]:
            await self.send_event(
                _pairing_request.user_id,
                'match_found'
            )

    @atomic_async
    def _cancel_pairing_request_or_fail(self, user):
        """
        Cancels the pairing request for the user.
        If no pairing request is found, it will raise a NoCurrentPairingRequestException.

        It returns the deleted pairing request.
        """
        # Retrieve and lock the pairing request
        pairing_request = PairingRequest.objects.get_current_request(user, for_update=True)

        if not pairing_request:
            raise NoCurrentPairingRequestException(user)

        if pairing_request.status in [PairingRequest.Status.ACTIVE, PairingRequest.Status.IDLE]:
            pairing_request.delete()

            # Object is deleted in DB but not in memory, return it for the notification
            return pairing_request
        else:
            raise Exception('You cannot cancel a pairing request that is not active or idle')

    async def _notify_cancelled(self, cancelled_pairing_request, user_id=None):
        """
        Notifies the user that the pairing request has been cancelled.
        If you provide a user_id, it will be used instead of the pairing request's user ID.
        This is useful to notify the other user in the pairing.
        """
        user_id = user_id or cancelled_pairing_request.user_id
        await self.send_event(
            user_id,
            'cancel',
            {
                'from_current_user': user_id == cancelled_pairing_request.user_id
            }
        )

    async def _notify_paired(self, pairing_match):
        """
        Notifies the users that the pairing has been completed.
        """
        for pairing_request in [pairing_match.pairing_request_1, pairing_match.pairing_request_2]:
            await self.send_event(
                pairing_request.user_id,
                'paired',
                {
                    'discussion_id': pairing_match.related_discussion_id,
                }
            )

    @atomic_async
    def _create_pairing_request_or_fail(self, user, debate, desired_stance):
        """
        Creates a pairing request for the user in the specified debate.
        If the user already has an active pairing request, it will raise a PairingRequestAlreadyExistsException.
        """
        # Check if the user already has an active pairing request
        pairing_request = PairingRequest.objects.get_current_request(user, for_update=True)

        if pairing_request:
            raise PairingRequestAlreadyExistsException(user)

        # Create the pairing request
        return PairingRequest.objects.create(user=user, debate=debate, desired_stance=desired_stance)

    async def _notify_request_pairing(self, pairing_request):
        """
        Notifies the user that the pairing request has been created.
        """
        await self.send_event(
            pairing_request.user_id,
            'request_pairing'
        )
