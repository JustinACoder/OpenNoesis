from django.apps import AppConfig
from django.db.models.signals import post_migrate


def ensure_bot_user_post_migrate(sender, **kwargs):
    from discussion.ai import ensure_ai_bot_user
    ensure_ai_bot_user()


class DiscussionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'discussion'

    def ready(self):
        post_migrate.connect(
            ensure_bot_user_post_migrate,
            sender=self,
            dispatch_uid="discussion.ensure_bot_user_post_migrate",
            weak=False,
        )
