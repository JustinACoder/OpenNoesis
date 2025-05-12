from django.contrib.auth import get_user_model
from django.db.models import QuerySet, Q, F

from notifications.models import Notification

User = get_user_model()


class NotificationService:
    @staticmethod
    def get_notifications(user: User, only_unread = False) -> QuerySet[Notification]:
        """
        Get all notifications for a user.
        Returns an unevaluated queryset for pagination.
        """
        additional_filter = {"read": False} if only_unread else {}
        return Notification.objects.filter(
            user=user, **additional_filter
        ).annotate(
            notification_type_name=F('notification_type__name'),
        ).order_by('-created_at')
    
    @staticmethod
    def get_unread_count(user: User) -> int:
        """
        Get count of unread notifications for a user.
        """
        return Notification.objects.filter(user=user, read=False).count()
    
    @staticmethod
    def set_read_status(notification_id: int, user: User, read_status: bool = True) -> bool:
        """
        Set the read status of a notification.
        Returns True if the notification was successfully updated to a new read status. (i.e. if it was unread and is now read)
        """
        desired_current_status = not read_status
        return Notification.objects.filter(
            id=notification_id, user=user, read=desired_current_status
        ).update(read=read_status) > 0
    
    @staticmethod
    def mark_all_as_read(user: User) -> None:
        """
        Mark all notifications as read for a user.
        """
        Notification.objects.filter(user=user, read=False).update(read=True)
