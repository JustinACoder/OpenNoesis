from django.db import models
from debate.querysets import CommentQuerySet, DebateQuerySet


class CommentManager(models.Manager):
    def get_queryset(self):
        return CommentQuerySet(self.model, using=self._db)


class DebateManager(models.Manager):
    def get_queryset(self):
        return DebateQuerySet(self.model, using=self._db)
