from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db import transaction
from channels.db import database_sync_to_async
import functools


def get_user_group_name(consumer_class_name: str, user_id: int):
    return f'{consumer_class_name}_{user_id}'


def atomic_async(func):
    """Decorator that combines transaction.atomic and database_sync_to_async"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        sync_func = transaction.atomic(func)
        async_func = database_sync_to_async(sync_func)
        return await async_func(*args, **kwargs)
    return wrapper


class EventRouterMixin:
    """Mixin that routes events to their respective handler methods based on event_type"""
    event_handlers: dict[str, str] = {}

    async def receive_json(self, content, **kwargs):
        """
        Routes events to their respective handler methods.
        """
        event_type = content.get('event_type')
        handler_name = self.event_handlers.get(event_type)

        if not handler_name or not hasattr(self, handler_name):
            print(f'Invalid event_type (content: {content})')
            return await self.send_error(f'Invalid event_type: {event_type}')

        data = content.get('data', {})
        try:
            await getattr(self, handler_name)(data)
        except Exception as e:
            print(f'Error handling event {event_type}: {e}')
            await self.send_error(f'An error occurred while processing the request ({str(e)})', details=str(e))

    async def send_error(self, message: str, **extra):
        """
        Sends an error message to the client.
        """
        payload = {'status': 'error', 'message': message, **extra}
        print(f'Sending error: {payload}')
        await self.send_json(payload)

    async def send_success(self, event_type: str, data: dict = None, **extra):
        """
        Sends a success message to the client.
        """
        payload = {'status': 'success', 'event_type': event_type, 'data': data or {}, **extra}
        await self.send_json(payload)

    async def send_event(self, user_id: int, event_type: str, data: dict = None, *, status='success', **extra):
        """
        Sends an event to a specific user group.
        """
        group = get_user_group_name(self.__class__.__name__, user_id)
        await self.channel_layer.group_send(
            group,
            {
                'status': status,
                'type': 'send.json',
                'event_type': event_type,
                'data': data or {},
                **extra
            }
        )


class CustomBaseConsumer(EventRouterMixin, AsyncJsonWebsocketConsumer):
    """
    This is the base consumer for this project. It forces the user to be authenticated before connecting.
    It also handles the connection and disconnection.
    """

    async def connect(self):
        if not self.scope['user'].is_authenticated:
            await self.close(reason='You are not authenticated')
            return

        await self.accept()

        # Join group
        await self.channel_layer.group_add(
            get_user_group_name(self.__class__.__name__, self.scope['user'].id),
            self.channel_name
        )

    async def disconnect(self, close_code):
        await self.close(code=close_code)
