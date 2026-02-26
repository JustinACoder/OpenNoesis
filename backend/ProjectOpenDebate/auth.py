from ninja.security import SessionAuth


class OptionalDjangoAuth(SessionAuth):
    """
    Custom authentication class that allows for optional authentication.
    If the user is not authenticated, it will still allow access to the view.
    """
    def authenticate(self, request, key):
        return request.user # Always return the user object, even if not authenticated

optional_django_auth = OptionalDjangoAuth()