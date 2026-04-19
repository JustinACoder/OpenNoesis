import re
from datetime import datetime

from ninja import ModelSchema
from typing import Optional
from ninja import Schema, Field
from pydantic import field_validator
from debate.enums import VoteDirectionEnum, StanceDirectionEnum
from debate.models import Debate, Comment, Stance
from users.schemas import UserPreviewSchema


def strip_markdown_to_plain_text(value: str) -> str:
    value = re.sub(r"!\[([^]]*)]\([^)]+\)", r"\1", value)
    value = re.sub(r"\[([^]]+)]\([^)]+\)", r"\1", value)
    value = re.sub(r"\*\*([^*\n]+)\*\*", r"\1", value)
    value = re.sub(r"__([^_\n]+)__", r"\1", value)
    value = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", value)
    value = re.sub(r"(?<!_)_([^_\n]+)_(?!_)", r"\1", value)
    value = re.sub(r"`([^`\n]+)`", r"\1", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


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

class DebateWithStanceInputSchema(Schema):
    user_id: int = Field(None, description="User ID to retrieve debates for, if not provided, retrieves for the authenticated user")

class DebateCreateInputSchema(Schema):
    title: str = Field(..., min_length=8, max_length=100)
    description: str = Field(..., min_length=30, max_length=8000)

    @staticmethod
    def _normalize_whitespace(value: str) -> str:
        # Collapse all whitespace runs to a single space for length checks.
        return re.sub(r"\s+", " ", value).strip()

    @field_validator("title")
    def validate_title_after_trimming(cls, value: str) -> str:
        if len(cls._normalize_whitespace(value)) < 8:
            raise ValueError("title must contain at least 8 characters after whitespace normalization")
        return value

    @field_validator("description")
    def validate_description_after_trimming(cls, value: str) -> str:
        if len(cls._normalize_whitespace(value)) < 30:
            raise ValueError("description must contain at least 30 characters after whitespace normalization")
        return value


class DebateUpdateInputSchema(DebateCreateInputSchema):
    remove_image: bool = False

class DebateFullSchema(ModelSchema):
    author: Optional[UserPreviewSchema] = None  # Can be None if the debate was created by the system
    image_url: Optional[str] = None

    # Votes
    vote_score: int = 0
    vote_count: int = 0
    user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET

    # Stance
    num_for: int = 0
    num_against: int = 0
    user_stance: StanceDirectionEnum = StanceDirectionEnum.UNSET

    # User requests
    user_has_requested_for: bool = Field(False, alias='has_requested_for')
    user_has_requested_against: bool = Field(False, alias='has_requested_against')

    class Meta:
        model = Debate
        exclude = ['search_vector', 'vote', 'image']

    @staticmethod
    def resolve_image_url(debate: Debate) -> Optional[str]:
        if not debate.image:
            return None
        return debate.image.url


class DebateSchema(DebateFullSchema):
    description: str = Field(exclude=True)
    description_preview: str
    target_user_stance: StanceDirectionEnum = Field(None, description="Stance of the user targeted by the search, if applicable. This is different from user_stance which is the stance of the connected user on the debate.")

    @staticmethod
    def resolve_description_preview(debate: Debate) -> str:
        """
        Resolve the description preview for the debate.
        :param debate: The Debate object.
        :return: The preview of the description.
        """
        description = strip_markdown_to_plain_text(debate.description)
        if len(description) > 200:
            return description[:200] + "..."
        return description


class CommentSchema(ModelSchema):
    author: UserPreviewSchema

    # Votes
    vote_score: int = 0
    vote_count: int = 0
    user_vote: VoteDirectionEnum = VoteDirectionEnum.UNSET

    class Meta:
        model = Comment
        fields = '__all__'


class StanceSchema(ModelSchema):
    class Meta:
        model = Stance
        fields = '__all__'


class DebateSitemapSchema(Schema):
    slug: str
    date: datetime
    total_stances: int = 0
