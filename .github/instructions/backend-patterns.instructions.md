---
applyTo: "backend/**/*.py"
---

# Backend Patterns

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## API Pattern (Django Ninja)

Routers are defined per-app in `api.py` and registered in `ProjectOpenDebate/urls.py`.

```python
from ninja import Router
from ninja.security import django_auth
from ProjectOpenDebate.auth import optional_django_auth

router = Router(auth=optional_django_auth)  # Mixed auth (anonymous + authenticated)

@router.get("/trending", response=List[DebateSchema])
@paginate(PageNumberPagination, page_size=10)
def trending_debates(request):
    user = request.auth  # User object or AnonymousUser
    return DebateService.get_debate_queryset(user).get_trending()

@router.get("/protected", response=SomeSchema, auth=django_auth)  # Requires auth
def protected_endpoint(request):
    user = request.auth  # Always authenticated user
    ...
```

**Key Points**:
- Use `Router(auth=django_auth)` for protected routes
- Use `Router(auth=optional_django_auth)` for mixed access
- Override per-endpoint with `auth=` parameter
- Schemas use `ModelSchema` with `Meta.model` and `exclude`/`fields`
- Pagination: `PageNumberPagination` for lists, `CursorPagination` for infinite scroll/rapidly changing data

---

## Service Layer Pattern

Services encapsulate business logic and return annotated and importantly unevaluated QuerySets.
This should allow the api layer to remain thin. This part should not focus on serialization or request/response handling.

---

## Schema Pattern

Schemas are defined in `schemas.py` using `ModelSchema` or `Schema` from `ninja`.
Use `ModelSchema` whenever possible to leverage automatic field generation from models.
Do not use `class Config:` as this is the old way from Pydantic—use `Meta` instead.

---

## Authentication

Session-based auth via `django-allauth` in headless mode.

---

## Celery Tasks

Config in `ProjectOpenDebate/celery.py`, auto-discovers `tasks.py` files.

**Key Points**:
- Use `@shared_task` decorator
- Wrap DB operations in `transaction.atomic` where needed in case the task is canceled
- Beat schedule in `settings.py` under `CELERY_BEAT_SCHEDULE`

---

## Database Considerations

- Use `select_related` and `prefetch_related` for N+1 prevention
- Annotate computed fields via subqueries in QuerySets (and then use indexes to optimize)
- Keep queries unevaluated until serialization as much as possible
