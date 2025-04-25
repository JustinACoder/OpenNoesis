from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.search import SearchVector, SearchVectorField, SearchQuery, SearchRank
from django.db import models
from django.db.models import Count, Case, When, Window, Max, Q, OuterRef, Subquery, Sum
from django.template.defaultfilters import slugify
from django.db.models import F, Func, Value, StdDev
from django.db.models.functions import Coalesce, Log, Greatest, Now, Abs, Cast
from django.contrib.postgres.indexes import GinIndex
from voting.models import Vote
from datetime import timedelta

User = get_user_model()


class DebateManager(models.Manager):
    def get_queryset(self):
        return DebateQuerySet(self.model, using=self._db)


class Debate(models.Model):
    title = models.CharField(max_length=100, unique=True)
    description = models.TextField()
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


class CommentManager(models.Manager):
    def get_queryset(self):
        return CommentQuerySet(self.model, using=self._db)


class Comment(models.Model):
    debate = models.ForeignKey(Debate, on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    date_added = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    objects = CommentManager()

    def __str__(self):
        return f"Comment by {self.author} on \"{self.debate.title}\""


class Stance(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    debate = models.ForeignKey(Debate, on_delete=models.CASCADE)
    stance = models.IntegerField(choices=[(1, 'FOR'), (-1, 'AGAINST')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'debate')  # A user can only have one stance on a debate
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'debate'])
        ]

    def __str__(self):
        return f"Stance of {self.user} on \"{self.debate.title}\""


# Must be after Debate to avoid circular import
from discussion.models import DiscussionRequest


class DebateQuerySet(models.QuerySet):
    def with_votes(self, user: User):
        queryset = self.annotate(
            vote_score=Coalesce(Sum(F('vote__vote')), 0),
            vote_count=Count('vote')
        )

        # If the user is authenticated, add the user's vote to the queryset
        # Otherwise, set the value to null
        if user.is_authenticated:
            debate_content_type = ContentType.objects.get_for_model(Debate)
            queryset = queryset.annotate(
                user_vote=Subquery(
                    Vote.objects.filter(
                        debate=OuterRef('pk'),
                        user=user,
                        content_type=debate_content_type
                    ).values('vote')[:1]
                )
            )
        else:
            queryset = queryset.annotate(user_vote=0)

        return queryset

    def with_stance(self, user: User):
        queryset = self.annotate(
            num_for=Count(Case(When(stance__stance=True, then=1))),
            num_against=Count(Case(When(stance__stance=False, then=1))),
        )

        if user.is_anonymous:
            return queryset.annotate(user_stance=0)
        else:
            return queryset.annotate(
                user_stance=Coalesce(
                    Subquery(
                        Stance.objects.filter(debate=OuterRef('pk'), user=user).values('stance')[:1]
                    ),
                    0)
            )

    def with_user_requests(self, user: User):
        if user.is_anonymous:
            return self.annotate(
                has_requested_for=Value(False, output_field=models.BooleanField()),
                has_requested_against=Value(False, output_field=models.BooleanField()),
            )
        else:
            subquery_user_requests = DiscussionRequest.objects.filter(
                debate=OuterRef('pk'),
                requester=user
            )

            return self.annotate(
                has_requested_for=Subquery(subquery_user_requests.filter(stance_wanted=1).exists()),
                has_requested_against=Subquery(subquery_user_requests.filter(stance_wanted=-1).exists()),
            )

    def get_popular(self):
        return self.annotate(_ord_num_votes=Count('vote')).order_by('-_ord_num_votes')

    def get_recent(self):
        return self.order_by('-date')

    def get_trending(self):
        """
        We will keep it simple for now and order by the ratio of votes between now and the maximum between -48 hours
        and the debate's creation date. Then, we multiply by the log2 of the number of votes to give more weight to debates
        with more votes.
        """
        # Get the maximum between -48 hours and the debate's creation date
        past_date = Greatest(F('date'), Now() - timedelta(hours=48))

        # Get the number of votes between the past date and now
        num_votes_since = Count('vote', filter=Q(vote__time_stamp__gte=past_date))

        # Number of votes in total
        num_votes_total = Count('vote')

        # Calculate the percentage of votes in the period (+1 to avoid division by zero)
        percentage_votes_in_period = num_votes_since / (num_votes_total + 1)

        # Multiply by the log2 of the number of votes (+1 to avoid log(0))
        score = percentage_votes_in_period * Log(2, num_votes_total + 1)

        return self.annotate(_ord_score=score).order_by('-_ord_score')

    def get_controversial(self):
        """
        To determine the controversy of a debate, we will calculate the standard deviation of the stances.
        The lower the standard deviation, the more controversial the debate is since it means that the stances are
        more evenly distributed.
        """
        stddev = StdDev(Cast('stance__stance', models.IntegerField()))

        return self.annotate(_ord_stance_stddev=stddev).order_by('_ord_stance_stddev')

    def get_random(self):
        return self.order_by('?')

    def search(self, query: str):
        search_vector = (
                SearchVector('title', weight='A') +
                SearchVector('description', weight='C')
        )
        search_query = SearchQuery(query)

        return self.annotate(
            _ord_rank=SearchRank(search_vector, search_query)
        ).filter(_ord_rank__gt=0.1).order_by('-_ord_rank')


class CommentQuerySet(models.QuerySet):
    def with_votes(self, user: User):
        queryset = self.annotate(
            vote_score=Coalesce(Sum(F('vote__vote')), 0),
            vote_count=Count('vote')
        )

        # If the user is authenticated, add the user's vote to the queryset
        # Otherwise, set the value to null
        if user.is_authenticated:
            comment_content_type = ContentType.objects.get_for_model(Comment)
            queryset = queryset.annotate(
                user_vote=Subquery(
                    Vote.objects.filter(
                        content_type=comment_content_type,
                        object_id=OuterRef('pk'),
                        user=user
                    ).values('vote')[:1]
                )
            )
        else:
            queryset = queryset.annotate(user_vote=0)

        return queryset

    def get_popular(self):
        return self.annotate(_ord_num_votes=Count('vote')).order_by('-_ord_num_votes')
