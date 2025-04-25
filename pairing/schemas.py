from ninja import ModelSchema

from debate.schemas2 import DebatePreviewSchema
from pairing.models import PairingRequest


class PairingRequestSchema(ModelSchema):
    debate: DebatePreviewSchema
    class Config:
        model = PairingRequest
        model_exclude = ['user']