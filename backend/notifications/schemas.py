from ninja import ModelSchema, Schema
from typing import Dict, Any

from notifications.models import Notification
from pydantic import BaseModel

class NotificationReadPayload(BaseModel):
    notification_id: int
    is_read: bool

class NotificationReadStatusInputSchema(Schema):
    read_status: bool

class NotificationSchema(ModelSchema):
    title: str
    message: str
    endnote: str
    notification_type_name: str
    info_args: Dict[str, Any] = {}

    class Meta:
        model = Notification
        exclude = ["user", "notification_type"]
