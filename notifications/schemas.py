from ninja import ModelSchema, Schema
from typing import Dict, Any, Optional, Type

from ninja.schema import S

from notifications.models import Notification


class NotificationSchema(ModelSchema):
    title: str
    message: str
    endnote: str
    notification_type_name: str
    info_args: Dict[str, Any] = {}

    class Config:
        model = Notification
        model_exclude = ["user"]

    @classmethod
    def from_orm(cls, notif: Notification, **kw) -> "NotificationSchema":
        """
        Custom from_orm method to convert Notification model instance to NotificationSchema.
        """
        return cls(
            id=notif.id,
            title=notif.title,
            message=notif.message,
            endnote=notif.endnote,
            notification_type_name=notif.notification_type.name,
            info_args=notif.info_args,
            read=notif.read,
            data=notif.data,
            created_at=notif.created_at,
        )

