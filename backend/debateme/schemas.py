from ninja import ModelSchema, Schema

from debate.schemas2 import DebatePreviewSchema
from debateme.models import InviteUse, Invite
from users.schemas import UserPreviewSchema


class CreateInviteSchema(Schema):
    debate_slug: str

class InviteSchema(ModelSchema):
    debate: DebatePreviewSchema
    creator: UserPreviewSchema

    class Config:
        model = Invite
        model_fields = '__all__'

class InviteUseSchema(ModelSchema):
    user: UserPreviewSchema

    class Config:
        model = InviteUse
        model_fields = '__all__'