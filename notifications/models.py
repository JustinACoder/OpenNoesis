from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Subquery


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

    def create_new_discussion_notification(self, user_to_notify, other_user_name, discussion_id, debate_title):
        """ Create a new discussion notification for the user. """
        return self.create(
            user_id=user_to_notify,
            notification_type_id=Subquery(
                NotificationType.objects.filter(name='new_discussion').values('id')[:1]
            ),
            data={
                'debate_title': debate_title,
                'participant_username': other_user_name
            },
            url_name='specific_discussion',
            url_args={'discussion_id': discussion_id}
        )

    def create_new_message_notification(self, user, message):
        return self.create(
            user=user,
            notification_type=NotificationType.objects.get(name='new_message'),
            data={
                'debate_title': message.discussion.debate.title,
                'participant_username': message.author.username
            },
            url_name='specific_discussion',
            url_args={'discussion_id': message.discussion.id}
        )

    def create_accepted_invite_notification(self, invite, invite_use, accepting_user):
        return self.create(
            user=invite.creator,
            notification_type=NotificationType.objects.get(name='accepted_invite'),
            data={
                'debate_title': invite.debate.title,
                'participant_username': accepting_user.username,
            },
            url_name='specific_discussion',
            url_args={'discussion_id': invite_use.resulting_discussion.id}
        )


class Notification(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    notification_type = models.ForeignKey(NotificationType, on_delete=models.CASCADE)
    data = models.JSONField(default=dict)  # of the form {'arg1': 'abc', 'arg2': 'def'} for "template: {arg1}-{arg2}"
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    info_args = models.JSONField(default=dict) # refers to the data used for potentially redirect on the frontend

    objects = NotificationManager()

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
        return f'Notification for {self.user.username} at {self.created_at}'
