from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.db import models
from django.db.models import Subquery, OuterRef, Value, IntegerField, Q, Exists, Count, F, StdDev
from django.db.models.functions import Coalesce, Cast, Greatest, Now, Log

from debate.models import Stance, Vote
from pairing.models import PairingRequest

User = get_user_model()


def with_votes_score_and_count(qs: models.QuerySet) -> models.QuerySet:
    model_content_type = ContentType.objects.get_for_model(qs.model)  # this is cached so no performance issue
    votes_agg = (
        Vote.objects
        .filter(content_type=model_content_type, object_id=OuterRef('pk'))
        .values('object_id')
        .annotate(
            score=models.Sum('vote'),
            cnt=models.Count('id'),
        )
    )

    return qs.annotate(
        vote_score=Coalesce(
            Subquery(votes_agg.values('score')[:1]),
            Value(0, output_field=IntegerField()),
        ),
        vote_count=Coalesce(
            Subquery(votes_agg.values('cnt')[:1]),
            Value(0, output_field=IntegerField()),
        ),
    )


class DebateQuerySet(models.QuerySet):
    def public(self):
        return self.filter(hidden=False)

    def with_votes(self, user: User):
        queryset = with_votes_score_and_count(self)

        # If the user is authenticated, add the user's vote to the queryset
        # Otherwise, set the value to null
        if user.is_authenticated:
            debate_content_type = ContentType.objects.get_for_model(self.model)
            queryset = queryset.annotate(
                user_vote=Coalesce(
                    Subquery(
                        Vote.objects.filter(
                            object_id=OuterRef('pk'),
                            user=user,
                            content_type=debate_content_type
                        ).values('vote')[:1]
                    ),
                    Value(0)
                )
            )
        else:
            queryset = queryset.annotate(user_vote=Value(0))

        return queryset

    def with_stance(self, user: User):
        stance_agg = (
            Stance.objects
            .filter(debate_id=OuterRef('pk'))
            .values('debate_id')
            .annotate(
                num_for=models.Count('id', filter=Q(stance=1)),
                num_against=models.Count('id', filter=Q(stance=-1)),
            )
        )

        queryset = self.annotate(
            num_for=Coalesce(
                Subquery(stance_agg.values('num_for')[:1]),
                Value(0, output_field=IntegerField()),
            ),
            num_against=Coalesce(
                Subquery(stance_agg.values('num_against')[:1]),
                Value(0, output_field=IntegerField()),
            ),
        )

        if user.is_anonymous:
            return queryset.annotate(user_stance=Value(0))
        else:
            return queryset.annotate(
                user_stance=Coalesce(
                    Subquery(
                        Stance.objects.filter(debate=OuterRef('pk'), user=user).values('stance')[:1]
                    ),
                    Value(0, output_field=IntegerField())
                )
            )

    def with_user_requests(self, user: User):
        if user.is_anonymous:
            return self.annotate(
                has_requested_for=Value(False, output_field=models.BooleanField()),
                has_requested_against=Value(False, output_field=models.BooleanField()),
            )
        else:
            subquery_user_requests = PairingRequest.objects.filter(
                debate=OuterRef('pk'),
                user=user,
                status=PairingRequest.Status.PASSIVE
            )

            return self.annotate(
                has_requested_for=Exists(subquery_user_requests.filter(desired_stance=1)),
                has_requested_against=Exists(subquery_user_requests.filter(desired_stance=-1)),
            )

    def get_featured(self):
        return self.filter(featured_on__isnull=False).order_by("-featured_on", "-date")

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
        queryset = with_votes_score_and_count(self)

        # If the user is authenticated, add the user's vote to the queryset
        # Otherwise, set the value to null
        if user.is_authenticated:
            comment_content_type = ContentType.objects.get_for_model(self.model)
            queryset = queryset.annotate(
                user_vote=Coalesce(
                    Subquery(
                        Vote.objects.filter(
                            content_type=comment_content_type,
                            object_id=OuterRef('pk'),
                            user=user
                        ).values('vote')[:1]
                    ),
                    Value(0)
                )
            )
        else:
            queryset = queryset.annotate(user_vote=Value(0))

        return queryset

    def get_popular(self):
        return self.annotate(_ord_num_votes=Count('vote')).order_by('-_ord_num_votes')
