from ProjectOpenDebate.consumers import CustomBaseConsumer
from pairing.models import PairingRequest
from channels.db import database_sync_to_async


class PairingConsumer(CustomBaseConsumer):
    """
    This consumer handles the WebSocket connection for pairing users together.
    """
    stream_name = 'pairing'
    event_handlers = {
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
