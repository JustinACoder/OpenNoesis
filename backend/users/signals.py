from time import perf_counter

from allauth.account.models import EmailAddress
from allauth.account.signals import user_logged_in, user_signed_up
from django.contrib.auth import get_user_model
from django.dispatch import receiver

from ProjectOpenDebate.common.metrics import record_api_operation

User = get_user_model()


@receiver(user_signed_up)
def monitor_user_signed_up(request, user: User, **kwargs):
    """Record successful sign-up events."""
    start = perf_counter()
    record_api_operation(operation="auth.signup", status="success", duration_seconds=perf_counter() - start)


@receiver(user_logged_in)
def monitor_user_logged_in(request, user: User, **kwargs):
    """Record successful logins only when the user's email is verified."""
    verified = EmailAddress.objects.filter(user=user, verified=True).exists()
    if not verified:
        return

    start = perf_counter()
    record_api_operation(operation="auth.login", status="success", duration_seconds=perf_counter() - start)
