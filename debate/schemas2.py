from ninja import ModelSchema

from debate.models import Debate
from users.schemas import UserPreviewSchema


class DebatePreviewSchema(ModelSchema):
    author: UserPreviewSchema
    class Config:
        model = Debate
        model_fields = ['id', 'title', 'slug']