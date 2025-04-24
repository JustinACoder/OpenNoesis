from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from ProjectOpenDebate.consumers import get_user_group_name
from notifications.models import Notification
from notifications.schemas import NotificationSchema


@receiver(post_save, sender=Notification)
def send_notification(sender, instance, created, **kwargs):
    """
    Send the notification to the user using the WebSocket.
    """
    if not created:
        return

    # Get current channel layer
    channel_layer = get_channel_layer()

    # Get the user group name
    user_group_name = get_user_group_name('NotificationConsumer', instance.user_id)

    # Create a notification data object matching the schema structure
    notification_data = NotificationSchema(
        id=instance.id,
        title=instance.title,
        message=instance.message,
        endnote=instance.endnote,
        notification_type_name=instance.notification_type.name,
        info_args=instance.info_args,
        read=instance.read,
        data=instance.data,
        created_at=instance.created_at
    ).dict(
        exclude_unset=True,
    )

    # Send the notification to the user
    async_to_sync(channel_layer.group_send)(
        user_group_name,
        {
            'status': 'success',
            'event_type': 'new_notification',
            'type': 'send.json',
            'data': notification_data
        }
    )
