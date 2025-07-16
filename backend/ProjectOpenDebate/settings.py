from pathlib import Path
from celery.schedules import crontab
from django.contrib import messages
import os
import environ
from django.urls import reverse

env = environ.Env()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
ENV = env("ENV", default="dev")
DEBUG = ENV == "dev"
print("Running in", ENV, "mode")

ALLOWED_HOSTS = []  # TODO: Add allowed hosts such as the domain name of the website

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
    # 'allauth.socialaccount.providers.google',
    'debug_toolbar',
    'django_celery_results',
    'django_celery_beat',
    'voting',
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
if ENV == "dev":
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
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env("DB_NAME"),
        'USER': env("DB_USER"),
        'PASSWORD': env("DB_PASSWORD"),
        'HOST': env("DB_HOST"),
        'PORT': env("DB_PORT"),
        'TEST': {
            'NAME': 'debate_test', # Cannot be deleted, needs --keepdb
        }
    }
}

# Channel layer definitions
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [f"redis://:{env('REDIS_PASSWORD')}@{env('REDIS_HOST')}:{env('REDIS_PORT')}/{env('REDIS_DB')}"]
        }
    }
}

# If we are testing, we want to use the in-memory channel layer
if DEBUG:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# Celery settings
CELERY_BROKER_URL = f"redis://:{env('REDIS_PASSWORD')}@{env('REDIS_HOST')}:{env('REDIS_PORT')}/{env('REDIS_DB')}"
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
ACCOUNT_EMAIL_SUBJECT_PREFIX = '[DebateArena] '
ACCOUNT_AUTHENTICATION_METHOD = 'username_email'
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
ACCOUNT_EMAIL_REQUIRED = True
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

# TODO: Change this to the actual frontend URL in production
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": "https://localhost/account/verify-email/?token={key}",
    "account_reset_password": "https://localhost/account/password/reset",
    "account_reset_password_from_key": "https://localhost/account/password/reset/key/{key}",
    "account_signup": "https://localhost/account/signup",
    # Fallback in case the state containing the `next` URL is lost and the handshake
    # with the third-party provider fails.
    "socialaccount_login_error": "https://localhost/account/provider/callback",
}

# Email backend settings
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"  # TODO: Change to real email backend in production
EMAIL_SUBJECT_PREFIX = '[DebateArena] '
DEFAULT_FROM_EMAIL = 'noreply@debatearena.com'

# Admins
ADMINS = [
    ('Admin', env("ADMIN_EMAIL", default="admin@gmail.com"))
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

# Ninja API settings
API_VERSION = "1.0.0"
API_TITLE = "ProjectOpenDebateAPI"
