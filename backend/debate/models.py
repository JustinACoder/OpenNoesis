import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericRelation, GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.search import SearchVector, SearchVectorField
from django.db import models
from django.template.defaultfilters import slugify
from django.contrib.postgres.indexes import GinIndex, BTreeIndex
from django.utils.timezone import now

User = get_user_model()


def debate_image_upload_to(instance, filename):
    suffix = Path(filename).suffix.lower()
    return f"debate_images/{now():%Y/%m/%d}/{uuid.uuid4().hex}{suffix}"


class Stance(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    debate = models.ForeignKey("Debate", on_delete=models.CASCADE)
    stance = models.SmallIntegerField(choices=[(1, 'FOR'), (-1, 'AGAINST')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'debate')  # A user can only have one stance on a debate
        indexes = [
            models.Index(fields=['user', '-created_at']),
            # Covers the per-debate aggregate with a filter on stance:
            BTreeIndex(
                fields=['debate', 'stance'],
                name='stance_debate_stance_idx',
                include=['id'],  # lets COUNT(id) use index-only in many cases
            ),
        ]

    def __str__(self):
        return f"Stance of {self.user} on \"{self.debate.title}\""


class VoteManager(models.Manager):
    def record_vote(self, obj, user, vote):
        """
        Record a user's vote on a given object. Only allows a given user
        to vote once, though that vote may be changed.

        A zero vote indicates that any existing vote should be removed.
        """
        if vote not in (+1, 0, -1):
            raise ValueError("Invalid vote (must be +1/0/-1)")
        ctype = ContentType.objects.get_for_model(obj)
        try:
            v = self.get(user=user, content_type=ctype, object_id=obj._get_pk_val())
            if vote == 0:
                v.delete()
            else:
                v.vote = vote
                v.save()
        except models.ObjectDoesNotExist:
            # that must mean that the vote doesnt yet exist
            if vote == 0:
                return  # nothing to do, since no vote exists
            self.create(
                user=user,
                content_type=ctype,
                object_id=obj._get_pk_val(),
                vote=vote,
            )


SCORES = (
    (+1, "+1"),
    (-1, "-1"),
)


class Vote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    object = GenericForeignKey("content_type", "object_id")
    vote = models.SmallIntegerField(choices=SCORES)
    time_stamp = models.DateTimeField(editable=False, default=now)

    objects = VoteManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['content_type', 'object_id', 'user'],
                name='unique_user_vote_per_object',
            ),
        ]
        indexes = [
            BTreeIndex(
                fields=['content_type', 'object_id'],
                name='votes_ct_obj_idx',
                include=['vote', 'id'],
            ),
            BTreeIndex(
                fields=['content_type', 'object_id', 'user'],
                name='votes_ct_obj_user_idx',
                include=['vote', 'id'],
            ),
        ]

    def __str__(self):
        return f"{self.user}: {self.vote} on {self.object}"

    def is_upvote(self):
        return self.vote == 1

    def is_downvote(self):
        return self.vote == -1


from debate.managers import DebateManager, CommentManager


class Debate(models.Model):
    title = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    image = models.FileField(upload_to=debate_image_upload_to, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    slug = models.SlugField(max_length=100,
                            unique=True)  # WARNING: not generated automatically if using bulk operations
    vote = GenericRelation(Vote, related_query_name='debate')
    search_vector = SearchVectorField(null=True,
                                      editable=False)  # WARNING: not generated automatically if using bulk operations

    objects = DebateManager()

    class Meta:
        indexes = [
            # Gin index for full-text search
            GinIndex(fields=['search_vector'], name='search_vector_idx')
        ]

    def get_stance(self, user):
        try:
            return self.stance_set.get(user=user).stance
        except Stance.DoesNotExist:
            return 0

    def save(self, should_update_search_vector=True, *args, **kwargs):
        is_new = not self.id

        # If the debate is new, generate a slug
        if is_new:
            self.slug = slugify(self.title)

            # get the count of debates with the same slug
            count = Debate.objects.filter(slug=self.slug).count()

            # If there are debates with the same slug, append a number to the slug
            if count > 0:
                self.slug = f"{self.slug}-{count}"

        if not should_update_search_vector:
            super(Debate, self).save(*args, **kwargs)
            return

        # If the want to update the search vector, we need to ensure that we are updating the search vector not inserting
        if should_update_search_vector:
            if is_new:
                super(Debate, self).save(*args, **kwargs)

                # Update the search vector
                # This need to be done in update, not insert, because the search vector is a computed field
                self.search_vector = (
                        SearchVector('title', weight='A') +
                        SearchVector('description', weight='C')
                )

                self.save(should_update_search_vector=False)
            else:
                # If the debate is not new and we want to update the search vector
                self.search_vector = (
                        SearchVector('title', weight='A') +
                        SearchVector('description', weight='C')
                )

                super(Debate, self).save(*args, **kwargs)

    def __str__(self):
        return f"\"{self.title}\" by {self.author}"


class Comment(models.Model):
    debate = models.ForeignKey(Debate, on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    date_added = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    vote = GenericRelation(Vote, related_query_name='comment')

    objects = CommentManager()

    def __str__(self):
        return f"Comment by {self.author} on \"{self.debate.title}\""
