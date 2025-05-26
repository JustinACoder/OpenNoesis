from typing import List
from ninja import Router
from ninja.pagination import paginate, PageNumberPagination
from ninja.security import django_auth
from django.http import Http404

from notifications.schemas import NotificationSchema, NotificationReadStatusInputSchema
from notifications.services import NotificationService

# Initialize Ninja API router
router = Router(auth=django_auth)

@router.get("", response=List[NotificationSchema])
@paginate(PageNumberPagination, page_size=15)
def get_notifications(request, only_unread: bool = False):
    """
    Get paginated notifications for the current user.
    """
    return NotificationService.get_notifications(request.user, only_unread=only_unread)

@router.get("/unread-count", response=int)
def get_notifications_unread_count(request):
    """
    Get count of unread notifications for the current user.
    """
    return NotificationService.get_unread_count(request.user)

@router.patch("/{int:notification_id}/read-status", response={204: None})
def set_notification_read_status(request, notification_id: int, read_status_data: NotificationReadStatusInputSchema):
    """
    Set the read status of a notification.
    """
    success = NotificationService.set_read_status(notification_id, request.user, read_status_data.read_status)
    if not success:
        raise Http404("Notification not found or already read.")
    return 204, None

@router.post("/read-all", response={204: None})
def mark_all_notifications_as_read(request):
    """
    Mark all notifications as read for the current user.
    """
    NotificationService.mark_all_as_read(request.user)
    return 204, None
