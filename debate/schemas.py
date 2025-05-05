from ninja import ModelSchema
from typing import Optional
from ninja import Schema, Field
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


## These were previously used but are now replaced by flattened fields in DebateSchema and CommentSchema
## However, we keep them here in case we need them as standalone endpoint responses in the future
# class VotesSchema(Schema):
#     score: int = 0
#     num_votes: int = 0
#     user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET
#
#
# class DebateStanceInfoSchema(Schema):
#     num_for: int = 0
#     num_against: int = 0
#     user_stance: StanceDirectionEnum = StanceDirectionEnum.UNSET
#
#
# class UserDebateRequestSchema(Schema):
#     has_requested_for: bool = False
#     has_requested_against: bool = False

class CommentInputSchema(Schema):
    text: str

class VoteInputSchema(Schema):
    direction: VoteDirectionEnum

class StanceInputSchema(Schema):
    stance: StanceDirectionEnum

class DebateFullSchema(ModelSchema):
    author: Optional[UserPreviewSchema] = None  # Can be None if the debate was created by the system

    # Votes
    vote_score: int = 0
    num_votes: int = 0
    user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET

    # Stance
    num_for: int = 0
    num_against: int = 0
    user_stance: StanceDirectionEnum = StanceDirectionEnum.UNSET

    # User requests
    user_has_requested_for: bool = Field(False, alias='has_requested_for')
    user_has_requested_against: bool = Field(False, alias='has_requested_against')

    class Config:
        model = Debate
        model_exclude = ['search_vector', 'vote']


class DebateSchema(DebateFullSchema):
    description: str = Field(exclude=True)
    description_preview: str

    @staticmethod
    def resolve_description_preview(debate: Debate) -> str:
        """
        Resolve the description preview for the debate.
        :param debate: The Debate object.
        :return: The preview of the description.
        """
        if len(debate.description) > 200:
            return debate.description[:200] + "..."
        return debate.description


class CommentSchema(ModelSchema):
    author: UserPreviewSchema

    # Votes
    vote_score: int = 0
    num_votes: int = 0
    user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET

    class Config:
        model = Comment
        model_fields = '__all__'


class StanceSchema(ModelSchema):
    class Config:
        model = Stance
        model_fields = '__all__'
