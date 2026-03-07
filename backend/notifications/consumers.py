import json
from pydantic import ValidationError
from ProjectOpenDebate.consumers import CustomBaseConsumer
from .models import Notification
from .schemas import NotificationReadPayload

class NotificationConsumer(CustomBaseConsumer):
    """
    This consumer handles the WebSocket connection for sending and reading Notifications.
    """
    stream_name = 'notification'
    event_handlers = {
        'set_read': 'handle_set_read',
    }

    async def handle_set_read(self, data):
        """
        Handles marking a notification as read or unread.
        """
        try:
            payload = NotificationReadPayload(**data)
        except ValidationError as e:
            return await self.send_error('Invalid payload', details=json.loads(e.json()))

        user = self.scope['user']

        # Check that the notification exists and belongs to the user
        try:
            notification = await Notification.objects.aget(id=payload.notification_id, user=user)
        except Notification.DoesNotExist:
            return await self.send_error('Notification not found')

        # Mark the notification as read
        notification.read = payload.is_read
        await notification.asave()

        # Send message to the user group to update the notification list
        await self.send_event(
            user.id,
            'set_read',
            {
                'notification_id': notification.id,
                'is_read': payload.is_read
            }
        )
