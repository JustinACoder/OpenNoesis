from typing import Literal

from ninja import ModelSchema, Schema

from debate.schemas2 import DebatePreviewSchema
from pairing.models import PairingRequest


class PairingRequestInputSchema(Schema):
    debate_id: int
    desired_stance: Literal[-1, 1]


class PairingRequestSchema(ModelSchema):
    debate: DebatePreviewSchema

    class Config:
        model = PairingRequest
        model_exclude = ['user']
