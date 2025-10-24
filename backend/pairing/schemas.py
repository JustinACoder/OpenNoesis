from typing import Literal

from ninja import ModelSchema, Schema

from debate.schemas2 import DebatePreviewSchema
from pairing.models import PairingRequest


class PairingRequestInputSchema(Schema):
    debate_id: int
    desired_stance: Literal[-1, 1]
    pairing_type: Literal['active', 'passive']


class PairingRequestSchema(ModelSchema):
    debate: DebatePreviewSchema
    status: PairingRequest.Status

    class Config:
        model = PairingRequest
        model_exclude = ['user']

class CurrentActivePairingRequest(ModelSchema):
    debate: DebatePreviewSchema
    status: Literal[PairingRequest.Status.ACTIVE, PairingRequest.Status.MATCH_FOUND]

    class Config:
        model = PairingRequest
        model_exclude = ['user']