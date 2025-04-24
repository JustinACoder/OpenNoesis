from ninja import ModelSchema

from debate.models import Debate, Comment, Stance
from users.schemas import UserPreviewSchema

from typing import List
from ninja import Schema
from enum import IntEnum


class VoteDirectionEnum(IntEnum):
    DOWN = -1
    UNSET = 0
    UP = 1


class StanceDirectionEnum(IntEnum):
    FOR = 1
    UNSET = 0
    AGAINST = -1


class VotesSchema(Schema):
    score: int = 0
    num_votes: int = 0
    user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET


class DebateStanceInfoSchema(Schema):
    num_for: int = 0
    num_against: int = 0
    user_stance: StanceDirectionEnum = StanceDirectionEnum.UNSET


class UserDebateRequestSchema(Schema):
    has_requested_for: bool = False
    has_requested_against: bool = False


class VotesMixin:
    @classmethod
    def build_vote_info(cls, obj):
        return VotesSchema(
            score=obj.vote_score,
            num_votes=obj.num_votes,
            user_vote=obj.user_vote
        )

class DebateSchema(ModelSchema):
    author: UserPreviewSchema
    votes: VotesSchema
    stances: DebateStanceInfoSchema
    user_requests: UserDebateRequestSchema

    class Config:
        model = Debate
        model_exclude = ['search_vector', 'vote']

    @classmethod
    def from_orm(cls, obj: Debate, **kw) -> "DebateSchema":
        """
        Override the from_orm method to include custom logic for building vote info.
        """
        # Call the parent class's from_orm method
        instance = super().from_orm(obj, **kw)

        # Build the vote info using the VotesMixin
        instance.votes = VotesMixin.build_vote_info(obj) # noqa

        # Build the stance info
        instance.stances = DebateStanceInfoSchema(
            num_for=obj.num_for, # noqa
            num_against=obj.num_against, # noqa
            user_stance=StanceDirectionEnum(obj.user_stance) # noqa
        )

        # Build the user requests info
        instance.user_requests = UserDebateRequestSchema(
            has_requested_for=obj.has_requested_for, # noqa
            has_requested_against=obj.has_requested_against # noqa
        )

        # Return the modified instance
        return instance # noqa


class ExploreDebateListSchema(Schema):
    trending: List[DebateSchema]
    popular: List[DebateSchema]
    recent: List[DebateSchema]
    controversial: List[DebateSchema]
    random: List[DebateSchema]


class CommentSchema(ModelSchema):
    author: UserPreviewSchema
    votes: VotesSchema

    class Config:
        model = Comment
        model_fields = '__all__'

    @classmethod
    def from_orm(cls, obj: Comment, **kw) -> "CommentSchema":
        """
        Override the from_orm method to include custom logic for building vote info.
        """
        # Call the parent class's from_orm method
        instance = super().from_orm(obj, **kw)

        # Build the vote info using the VotesMixin
        instance.votes = VotesMixin.build_vote_info(obj) # noqa

        # Return the modified instance
        return instance # noqa


class StanceSchema(ModelSchema):
    class Config:
        model = Stance
        model_fields = '__all__'
