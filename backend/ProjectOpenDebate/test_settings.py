import os
import tempfile

os.environ.setdefault("R2_ACCOUNT_ID", "test-account")
os.environ.setdefault("R2_BUCKET_NAME", "test-bucket")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test-access-key")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test-secret-key")
os.environ.setdefault("R2_PUBLIC_BASE_URL", "https://media.test.invalid")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")

from ProjectOpenDebate.settings import * # noqa


DEBUG = False
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
MEDIA_URL = "/media/"
POST_OFFICE_DEFAULT_DELIVERY_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
POST_OFFICE = {
    **POST_OFFICE,
    "CELERY_ENABLED": False,
    "BACKENDS": {
        **POST_OFFICE["BACKENDS"],
        "default": POST_OFFICE_DEFAULT_DELIVERY_BACKEND,
    },
}
STORAGES["default"] = {
    "BACKEND": "django.core.files.storage.FileSystemStorage",
    "OPTIONS": {
        "location": tempfile.mkdtemp(prefix="opennoesis-test-media-"),
        "base_url": MEDIA_URL,
    },
}
