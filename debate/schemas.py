from ninja import ModelSchema
from typing import List
from ninja import Schema
from enum import IntEnum

from debate.models import Debate, Comment, Stance
from users.schemas import UserPreviewSchema


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

    @staticmethod
    def resolve_votes(obj):
        """
        Custom resolver for the votes field.
        This method is called when the votes field is accessed.
        """
        return VotesMixin.build_vote_info(obj)

    @staticmethod
    def resolve_stances(obj):
        """
        Custom resolver for the stances field.
        This method is called when the stances field is accessed.
        """
        return DebateStanceInfoSchema(
            num_for=obj.num_for,
            num_against=obj.num_against,
            user_stance=StanceDirectionEnum(obj.user_stance)
        )

    @staticmethod
    def resolve_user_requests(obj):
        """
        Custom resolver for the user_requests field.
        This method is called when the user_requests field is accessed.
        """
        return UserDebateRequestSchema(
            has_requested_for=obj.has_requested_for,
            has_requested_against=obj.has_requested_against
        )


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

    @staticmethod
    def resolve_votes(obj):
        """
        Custom resolver for the votes field.
        This method is called when the votes field is accessed.
        """
        return VotesMixin.build_vote_info(obj)


class StanceSchema(ModelSchema):
    class Config:
        model = Stance
        model_fields = '__all__'
