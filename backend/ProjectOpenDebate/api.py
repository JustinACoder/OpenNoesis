from django.middleware.csrf import get_token
from ninja import Router, Schema

# Initialize Ninja API
router = Router()


class CSRFTokenSchema(Schema):
    csrftoken: str

class AuthenticatedResponse(Schema):
    is_authenticated: bool


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
