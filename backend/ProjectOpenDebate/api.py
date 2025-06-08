from django.middleware.csrf import get_token
from ninja import Router, Schema

# Initialize Ninja API
router = Router()


class CSRFTokenSchema(Schema):
    csrftoken: str


# API Endpoints
@router.get("/set-csrf-token", response=CSRFTokenSchema)
def get_csrf_token(request):
    return CSRFTokenSchema(csrftoken=get_token(request))
