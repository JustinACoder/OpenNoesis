from ProjectOpenDebate.settings import * # noqa


DEBUG = False
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
POST_OFFICE_DEFAULT_DELIVERY_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
POST_OFFICE = {
    **POST_OFFICE,
    "CELERY_ENABLED": False,
    "BACKENDS": {
        **POST_OFFICE["BACKENDS"],
        "default": POST_OFFICE_DEFAULT_DELIVERY_BACKEND,
    },
}
