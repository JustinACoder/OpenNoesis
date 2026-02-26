from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Subquery

from ProjectOpenDebate.consumers import get_user_group_name


class NotificationType(models.Model):
    name = models.CharField(max_length=255)
    title_template = models.CharField(max_length=255)
    message_template = models.CharField(max_length=2000)
    endnote_template = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class NotificationManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().select_related('notification_type')

    def create_notification(self, user, notification_type_name: str, data=None, info_args=None):
        """
        Create a new notification for the user.
        :param user: The user to notify.
        :param notification_type_name: The name of the notification type.
        :param data: Additional data for the notification.
        :param info_args: Additional arguments for the notification.
        :return: The created notification instance.
        """
        new_notif = self.create(
            user=user,
            notification_type_id=Subquery(
                NotificationType.objects.filter(name=notification_type_name).values('id')[:1]
            ),
            data=data or {},
            info_args=info_args or {}
        )
        new_notif.send_notification()
        return new_notif

    def create_new_discussion_notification(self, user_to_notify, other_user_name, discussion_id, debate_title):
        """ Create a new discussion notification for the user. """
        return self.create_notification(
            user=user_to_notify,
            notification_type_name='new_discussion',
            data={
                'debate_title': debate_title,
                'participant_username': other_user_name
            },
            info_args={'discussion_id': discussion_id}
        )

    def create_new_message_notification(self, user, message):
        return self.create_notification(
            user=user,
            notification_type_name='new_message',
            data={
                'debate_title': message.discussion.debate.title,
                'participant_username': message.author.username
            },
            info_args={'discussion_id': message.discussion.id}
        )

    def create_accepted_invite_notification(self, invite, invite_use, accepting_user):
        return self.create_notification(
            user=invite.creator,
            notification_type_name='accepted_invite',
            data={
                'debate_title': invite.debate.title,
                'participant_username': accepting_user.username,
            },
            info_args={'discussion_id': invite_use.resulting_discussion.id}
        )


class Notification(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    notification_type = models.ForeignKey(NotificationType, on_delete=models.CASCADE)
    data = models.JSONField(default=dict)  # of the form {'arg1': 'abc', 'arg2': 'def'} for "template: {arg1}-{arg2}"
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    info_args = models.JSONField(default=dict)  # refers to the data used for potentially redirect on the frontend

    objects = NotificationManager()

    def send_notification(self):
        """
        Send the notification to the user using the WebSocket.
        """
        from notifications.schemas import NotificationSchema  # import here to prevent circular import

        # Get current channel layer
        channel_layer = get_channel_layer()

        # Get the user group name
        user_group_name = get_user_group_name('NotificationConsumer', self.user_id)  # noqa

        # Create a notification data object matching the schema structure
        notification_data = NotificationSchema.model_validate(self).model_dump(mode="json")

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

    @property
    def title(self):
        return self.notification_type.title_template.format(**self.data)

    @property
    def message(self):
        return self.notification_type.message_template.format(**self.data)

    @property
    def endnote(self):
        return self.notification_type.endnote_template.format(**self.data)

    def __str__(self):
        return f'Notification for {self.user.username} at {self.created_at}'  # noqa
