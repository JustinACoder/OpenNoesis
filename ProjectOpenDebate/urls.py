import debug_toolbar
from django.contrib import admin
from django.urls import path, include
from ninja import NinjaAPI
from discussion.api import router as discussion_router
from debateme.api import router as debateme_router
from debate.api import router as debate_router
from notifications.api import router as notifications_router
from users.api import router as users_router
from pairing.api import router as pairing_router

api = NinjaAPI()

api.add_router('/discussions', discussion_router, tags=['Discussions'])
api.add_router('/invites', debateme_router, tags=['Invites'])
api.add_router('/debates', debate_router, tags=['Debate'])
api.add_router('/notifications', notifications_router, tags=['Notifications'])
api.add_router('/users', users_router, tags=['Users'])
api.add_router('/pairing', pairing_router, tags=['Pairing'])

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.urls")), # For social login
    path('__debug__/', include(debug_toolbar.urls))
]
