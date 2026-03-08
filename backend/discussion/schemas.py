from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, constr

from ninja import ModelSchema, Field, Schema

from debate.schemas2 import DebatePreviewSchema
from discussion.models import ReadCheckpoint, Message, Discussion
from users.schemas import UserPreviewSchema

class NewMessagePayload(BaseModel):
    discussion_id: int
    message: constr(min_length=1, max_length=5000) = Field(..., description="The message text")

class ReadMessagesPayload(BaseModel):
    discussion_id: int
    through_load_discussion: bool = False

class ArchiveStatusInputSchema(Schema):
    status: bool


class StartAIDiscussionInputSchema(Schema):
    debate_id: int
    desired_stance: Literal[-1, 1]


class MessageSchema(ModelSchema):
    text: str = Field(..., max_length=5000)
    class Meta:
        model = Message
        fields = '__all__'

class DiscussionSchema(ModelSchema):
    debate: DebatePreviewSchema
    participant1: UserPreviewSchema
    participant2: UserPreviewSchema
    latest_message_text: Optional[str]
    latest_message_created_at: Optional[datetime]
    latest_message_author_id: Optional[int]
    is_archived: bool
    is_unread: bool
    latest_activity: datetime
    is_ai_discussion: bool = False
    inviteuse_id: Optional[int] = Field(None, alias='inviteuse__id')

    class Meta:
        model = Discussion
        fields = '__all__'

class ReadCheckpointSchema(ModelSchema):
    class Meta:
        model = ReadCheckpoint
        fields = '__all__'
