from pathlib import Path
from celery.schedules import crontab
from django.contrib import messages
import os
import environ
from django.urls import reverse

env = environ.Env()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: don't run with debug turned on in production!
ENV = env("ENV", default="dev")
DEBUG = ENV == "dev"
print("Running in", ENV, "mode")

# SECURITY WARNING: keep the secret key used in production secret!
default_unsafe_secret = 'unsafe-secret-key'
SECRET_KEY = env("SECRET_KEY", default=default_unsafe_secret)
if SECRET_KEY == default_unsafe_secret:
    print("WARNING: Using unsafe default secret key.")
    if ENV == "prod":
        raise ValueError("In production, you must set a secure SECRET_KEY environment variable.")

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[]) + ['localhost', '127.0.0.1', '[::1]']

INSTALLED_APPS = [
    'daphne',
    'channels',
    'django_extensions',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'allauth',
    'allauth.account',
    'allauth.headless',
    'allauth.socialaccount',
    'allauth.usersessions', # To manage sessions across multiple devices
    # 'allauth.socialaccount.providers.google',
    'debug_toolbar',
    'django_celery_results',
    'django_celery_beat',
    'django_ses',
    'debate.apps.DebateConfig',
    'users.apps.UsersConfig',
    'discussion.apps.DiscussionConfig',
    'debateme.apps.DebatemeConfig',
    'notifications.apps.NotificationsConfig',
    'pairing.apps.PairingConfig'
]

ASGI_APPLICATION = 'ProjectOpenDebate.asgi.application'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

if ENV == "prod":
    # Production CORS configuration
    CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
    CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

    # Security settings for production
    SECURE_SSL_REDIRECT = False  # This is handled by nginx, not Django
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
else:
    # Add to 'corsheaders' if we are in dev (to allow cors requests from the frontend running on different port)
    INSTALLED_APPS.append('corsheaders')
    MIDDLEWARE.insert(0, 'corsheaders.middleware.CorsMiddleware')  # Ensure CORS middleware is first
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:3000',  # React frontend running on port 3000
    ]
    CORS_ALLOW_CREDENTIALS = True

    # Allow CSRF for local development
    CSRF_TRUSTED_ORIGINS = [
        'http://localhost:3000',
    ]

ROOT_URLCONF = 'ProjectOpenDebate.urls'

INTERNAL_IPS = [
    "127.0.0.1",
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ProjectOpenDebate.wsgi.application'

# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases
db_password = env("POSTGRES_PASSWORD", default="debate_password")
if db_password == "debate_password":
    print("WARNING: Using default database password. This is unsafe for production.")
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env("POSTGRES_DB", default="debate_db"),
        'USER': env("POSTGRES_USER", default="debate_user"),
        'PASSWORD': db_password,
        'HOST': env("POSTGRES_HOST", default="db"),
        'PORT': env("POSTGRES_PORT", default="5432"),
        'TEST': {
            'NAME': 'debate_test',
        }
    }
}

# Channel layer definitions
redis_host = env('REDIS_HOST', default='redis')
redis_port = env('REDIS_PORT', default='6379')
redis_db = env('REDIS_DB', default='0')
redis_password = env('REDIS_PASSWORD', default='')
redis_url = f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [redis_url],
        }
    }
}

# Celery settings
CELERY_BROKER_URL = redis_url
CELERY_RESULT_BACKEND = 'django-db'  # Should we store in redis instead?
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Allauth settings
HEADLESS_ONLY = True
ACCOUNT_EMAIL_SUBJECT_PREFIX = f'[{env("EMAIL_PREFIX", default="OpenNoesis")}] '
ACCOUNT_LOGIN_METHODS = {'email', 'username'}
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*', 'password2*']
ACCOUNT_CHANGE_EMAIL = True
ACCOUNT_EMAIL_UNKNOWN_ACCOUNTS = False
ACCOUNT_USERNAME_VALIDATORS = 'users.validators.username_validators'
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 7  # One week
ACCOUNT_USERNAME_BLACKLIST = [
    # Common usernames that should not be allowed
    'admin', 'administrator', 'root', 'system', 'support', 'help', 'info',
    'contact', 'webmaster', 'test', 'demo', 'guest', 'user', 'users',
    'moderator', 'moderators',

    # The 'me' username is used to redirect to the current user's profile
    'me',
]
# USERSESSIONS_TRACK_ACTIVITY = True  # See https://docs.allauth.org/en/dev/usersessions/installation.html if you want to track user sessions

# Frontend URLs
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/verify-email/?token={{key}}",
    "account_reset_password": f"{FRONTEND_URL}/forgot-password",
    "account_reset_password_from_key": f"{FRONTEND_URL}/reset-password/?token={{key}}",
    "account_signup": f"{FRONTEND_URL}/signup",
    # Fallback in case the state containing the `next` URL is lost and the handshake
    # with the third-party provider fails.
    "socialaccount_login_error": f"{FRONTEND_URL}/account/provider/callback",
}

# Email backend settings
# Use 'django_ses.SESBackend' for AWS SES via HTTP (bypasses SMTP port restrictions)
# Use 'django.core.mail.backends.smtp.EmailBackend' for traditional SMTP
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")

# SMTP settings (used when EMAIL_BACKEND is smtp.EmailBackend)
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=5)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")

# AWS SES settings (used when EMAIL_BACKEND is django_ses.SESBackend)
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_SES_REGION_NAME = env("AWS_SES_REGION_NAME", default="us-east-1")
AWS_SES_REGION_ENDPOINT = env("AWS_SES_REGION_ENDPOINT", default=f"email.{AWS_SES_REGION_NAME}.amazonaws.com")

EMAIL_SUBJECT_PREFIX = env("EMAIL_SUBJECT_PREFIX", default='[OpenNoesis] ')
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@opennoesis.com")

# Admins
ADMINS = [
    ('Admin', env("ADMIN_EMAIL", default="admin@opennoesis.com"))
]

# Pairing settings
PAIRING_KEEPALIVE_INTERVAL = 10  # seconds
PAIRING_REQUEST_EXPIRY_SECONDS = 30  # seconds

# Celery Beat Tasks
CELERY_BEAT_SCHEDULE = {
    "passive_pairing": {
        "task": "pairing.tasks.try_pairing_passive_requests",
        "schedule": crontab(minute="0"),
    },
}
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Default is 4, but 1 is recommended with long running tasks
## Late ACK
# If true, tasks are acknowledged after execution, not before. This can be useful in the case the worker suddenly
# crashes or stops while executing a task, as the task will be retried (if it hasn't exceeded max retries).
# However, when this is true, tasks may be executed more than once. In our case, with our current tasks, we care that
# tasks are not run more than once, so we set this to False. If the worker crashes, the task will be lost, but
# with the current tasks, this is acceptable as they are periodic tasks that will run again later anyway and catch
# any unprocessed items. To be safer though, we will put a grace period of 5 minutes on the worker so that it has time to
# finish processing tasks before being killed in case of deployment or shutdown.
CELERY_TASK_ACKS_LATE = False

# Ninja API settings
API_VERSION = "1.0.0"
API_TITLE = "ProjectOpenDebateAPI"
NINJA_PAGINATION_PER_PAGE = 20
NINJA_PAGINATION_MAX_LIMIT = 75
