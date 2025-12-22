from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from ninja import Router, Schema, ModelSchema

# Initialize Ninja API
router = Router()


class CSRFTokenSchema(Schema):
    csrftoken: str

class AuthenticatedResponse(Schema):
    is_authenticated: bool

class CurrentUserResponse(ModelSchema):
    # We need to explicitly define these fields as they are @property methods on the User model
    # and therefore wont be included in the ModelSchema by default.
    is_authenticated: bool
    is_anonymous: bool

    class Config:
        model = get_user_model()
        model_exclude = ['password']

# API Endpoints
@router.get("/set-csrf-token", response=CSRFTokenSchema)
def get_csrf_token(request):
    return CSRFTokenSchema(csrftoken=get_token(request))

@router.get("/is-authenticated", response=AuthenticatedResponse)
def is_authenticated(request):
    """
    Check if the user is authenticated.
    Returns True if authenticated, False otherwise.
    """
    return AuthenticatedResponse(is_authenticated=request.user.is_authenticated)

@router.get("get-current-user-object", response=CurrentUserResponse, auth=None)
def get_current_user_object(request):
    """
    Get the current user object no matter if authenticated or not.
    """
    return request.user