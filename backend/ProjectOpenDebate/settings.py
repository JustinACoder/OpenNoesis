from pathlib import Path
from datetime import timedelta
from celery.schedules import crontab
from django.contrib import messages
import os
import environ
from django.urls import reverse
from urllib.parse import urlparse

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
    'django_prometheus',
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
    'anymail',
    # 'allauth.socialaccount.providers.google',
    'debug_toolbar',
    'django_celery_results',
    'django_celery_beat',
    'post_office',
    'storages',
    'debate.apps.DebateConfig',
    'users.apps.UsersConfig',
    'discussion.apps.DiscussionConfig',
    'debateme.apps.DebatemeConfig',
    'notifications.apps.NotificationsConfig',
    'pairing.apps.PairingConfig'
]

ASGI_APPLICATION = 'ProjectOpenDebate.asgi.application'

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
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
        'ENGINE': 'django_prometheus.db.backends.postgresql',
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

PROMETHEUS_MULTIPROC_DIR = env("PROMETHEUS_MULTIPROC_DIR", default="/tmp/django_prometheus_multiproc")
# Keep this as a safety net for processes that do not start through the wrapper script.
os.makedirs(PROMETHEUS_MULTIPROC_DIR, exist_ok=True)

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
R2_ACCOUNT_ID = env("R2_ACCOUNT_ID")
R2_BUCKET_NAME = env("R2_BUCKET_NAME")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY")
R2_REGION = env("R2_REGION", default="auto")
R2_PUBLIC_BASE_URL = env("R2_PUBLIC_BASE_URL").rstrip("/")
parsed_r2_public_url = urlparse(R2_PUBLIC_BASE_URL)

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": R2_BUCKET_NAME,
            "access_key": R2_ACCESS_KEY_ID,
            "secret_key": R2_SECRET_ACCESS_KEY,
            "endpoint_url": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            "querystring_auth": False,
            "file_overwrite": False,
            "custom_domain": parsed_r2_public_url.netloc,
            "url_protocol": f"{parsed_r2_public_url.scheme}:",
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Image Settings
DEBATE_IMAGE_MAX_BYTES = env.int("DEBATE_IMAGE_MAX_BYTES", default=10 * 1024 * 1024)
DEBATE_IMAGE_MAX_PIXELS = env.int("DEBATE_IMAGE_MAX_PIXELS", default=12_000_000)
DEBATE_IMAGE_MIN_ASPECT_RATIO = env.float("DEBATE_IMAGE_MIN_ASPECT_RATIO", default=0.5)
DEBATE_IMAGE_MAX_ASPECT_RATIO = env.float("DEBATE_IMAGE_MAX_ASPECT_RATIO", default=3.0)

# AI debate settings
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_MODEL = env("OPENAI_MODEL", default="gpt-5-mini")
OPENAI_MODERATION_MODEL = env("OPENAI_MODERATION_MODEL", default="omni-moderation-latest")
OPENAI_TIMEOUT_SECONDS = env.int("OPENAI_TIMEOUT_SECONDS", default=15)
AI_CONTEXT_COMPACTION_TRIGGER_TOKENS = env.int("AI_CONTEXT_COMPACTION_TRIGGER_TOKENS", default=8192)
AI_MAX_OUTPUT_TOKENS = env.int("AI_MAX_OUTPUT_TOKENS", default=512)
AI_BOT_USERNAME = env("AI_BOT_USERNAME", default="opennoesis_ai")
AI_BOT_EMAIL = env("AI_BOT_EMAIL", default="ai@opennoesis.local")

# AI auto debate generation settings
AUTO_DEBATE_GENERATION_ENABLED = env.bool("AUTO_DEBATE_GENERATION_ENABLED", default=False)
AUTO_DEBATE_GENERATION_CANDIDATE_COUNT = env.int("AUTO_DEBATE_GENERATION_CANDIDATE_COUNT", default=3)
AUTO_DEBATE_WEB_LOOKBACK_HOURS = env.int("AUTO_DEBATE_WEB_LOOKBACK_HOURS", default=24)
AUTO_DEBATE_DISCORD_WEBHOOK_URL = env("AUTO_DEBATE_DISCORD_WEBHOOK_URL", default="")
AUTO_DEBATE_IMAGE_GENERATION_ENABLED = env.bool("AUTO_DEBATE_IMAGE_GENERATION_ENABLED", default=False)
AUTO_DEBATE_IMAGE_GENERATION_MODEL = env(
    "AUTO_DEBATE_IMAGE_GENERATION_MODEL",
    default="gemini-3.1-flash-image-preview",
)
AUTO_DEBATE_IMAGE_GENERATION_TIMEOUT_SECONDS = env.int(
    "AUTO_DEBATE_IMAGE_GENERATION_TIMEOUT_SECONDS",
    default=120,
)
GOOGLE_CLOUD_API_KEY = env("GOOGLE_CLOUD_API_KEY", default="")

# Allauth settings
HEADLESS_ONLY = True
ACCOUNT_ADAPTER = "ProjectOpenDebate.account_adapter.PostOfficeAccountAdapter"
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
    AI_BOT_USERNAME.lower(),
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
# django-post-office must be Django's EMAIL_BACKEND.
EMAIL_BACKEND = "post_office.EmailBackend"
# Delivery transport used by django-post-office's default backend alias.
POST_OFFICE_DEFAULT_DELIVERY_BACKEND = env(
    "POST_OFFICE_DELIVERY_BACKEND",
    default=env(
        "EMAIL_BACKEND",
        default="anymail.backends.resend.EmailBackend",
    ),
)

# Post Office queue settings
POST_OFFICE = {
    "CELERY_ENABLED": True,
    "MAX_RETRIES": 3,
    "RETRY_INTERVAL": timedelta(minutes=1),
    "BACKENDS": {
        "default": POST_OFFICE_DEFAULT_DELIVERY_BACKEND,
    },
    "LOG_LEVEL": 1,
}

RESEND_API_KEY = env("RESEND_API_KEY", default="")
ANYMAIL = {
    "RESEND_API_KEY": RESEND_API_KEY,
}

EMAIL_SUBJECT_PREFIX = env("EMAIL_SUBJECT_PREFIX", default='[OpenNoesis] ')
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="OpenNoesis <noreply@opennoesis.com>")

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
    "generate-debate-candidates": {
        "task": "debate.tasks.generate_debate_candidates_from_feeds",
        "schedule": crontab(minute="0", hour="8"),
    },
    "send-queued-mail": {
        "task": "post_office.tasks.send_queued_mail",
        "schedule": crontab(minute="*/10"),
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
