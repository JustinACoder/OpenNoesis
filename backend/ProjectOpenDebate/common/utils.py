from django.conf import settings
from django.urls import reverse_lazy


def reverse_lazy_api(view_name, **kwargs):
    """Helper function to get the full URL with the correct API namespace from settings"""
    namespaced_url = f"api-{settings.API_VERSION}:{view_name}"
    return reverse_lazy(namespaced_url, kwargs=kwargs)
