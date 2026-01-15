from typing import Optional
from ninja import ModelSchema
from debate.models import Debate
from users.schemas import UserPreviewSchema


class DebatePreviewSchema(ModelSchema):
    author: Optional[UserPreviewSchema] = None
    class Config:
        model = Debate
        model_fields = ['id', 'title', 'slug']