# AI Agent Instructions for ProjectOpenDebate

## Architecture Overview

This is a real-time debate platform with a Django + Channels backend and Next.js 15 frontend.

### Backend Stack
- **Django 5.2** + **Django Ninja** (REST API with type hints and Pydantic schemas)
- **Django Channels** + **Daphne** (WebSocket support via ASGI)
- **Celery** + **Redis** (async task queue with django-celery-beat for scheduling)
- **PostgreSQL** (with PostgreSQL-specific features: GIN indexes, advisory locks, full-text search)
- **django-allauth** (headless auth mode, session-based)

### Frontend Stack
- **Next.js 15** (App Router, RSC with client components)
- **React 19** + **TypeScript**
- **TanStack Query v5** (data fetching, caching, hydration)
- **Orval** (auto-generates API hooks from OpenAPI schema)
- **shadcn/ui** + **TailwindCSS v4**
- **Zod** + **react-hook-form** (form validation)

---

## Backend Patterns

### Django App Structure
Each app (`debate`, `discussion`, `debateme`, `notifications`, `pairing`, `users`) follows:
```
app/
├── api.py        # Django Ninja routes (Router)
├── schemas.py    # Pydantic schemas for request/response
├── services.py   # Business logic layer (static methods)
├── models.py     # Django ORM models
├── managers.py   # Custom model managers (if needed)
├── querysets.py  # Custom QuerySet classes with chainable annotations
├── consumers.py  # WebSocket consumers (if real-time features)
├── tasks.py      # Celery tasks (if background processing)
```

### API Pattern (Django Ninja)
- Routers are defined per-app in `api.py` and registered in `ProjectOpenDebate/urls.py`
- Use `Router(auth=django_auth)` for protected routes, `Router(auth=optional_django_auth)` for mixed
- Schemas use `ModelSchema` with `Meta.model` and `exclude/fields` for type-safe serialization
- Pagination: `PageNumberPagination` for lists, custom `CursorPagination` (in `common/utils.py`) for infinite scroll

### Service Layer Pattern
Services encapsulate business logic and return annotated QuerySets:
```python
class DebateService:
    @staticmethod
    def get_debate_queryset(user: User) -> DebateQuerySet:
        return Debate.objects.get_queryset().with_votes(user).with_stance(user)
```

### QuerySet Annotation Pattern
Custom QuerySets add computed fields via subqueries for efficient single-query fetches:
```python
class DebateQuerySet(models.QuerySet):
    def with_votes(self, user: User):
        return self.annotate(vote_score=..., vote_count=..., user_vote=...)
```

### WebSocket Architecture
- Single WebSocket endpoint: `/ws/`
- **Demultiplexer** (`ProjectOpenDebate/demultiplexer.py`) routes messages by `stream` field
- Streams: `discussion`, `notification`, `pairing`
- Base consumer: `CustomBaseConsumer` (in `ProjectOpenDebate/consumers.py`)
  - Requires authentication
  - Event routing via `event_handlers` dict
  - User group naming: `{ConsumerClassName}_{user_id}`

Consumer message format:
```json
{"stream": "discussion", "payload": {"event_type": "new_message", "data": {...}}}
```

### Celery Tasks
- Config in `ProjectOpenDebate/celery.py`, auto-discovers `tasks.py` files
- Beat schedule in `settings.py` under `CELERY_BEAT_SCHEDULE`
- Use `@shared_task` decorator and `transaction.atomic` for DB operations
- Advisory locks (`pg_advisory_xact_lock`) for concurrent pairing requests

### Authentication
- Session-based auth via `django-allauth` in headless mode
- Endpoints under `/_allauth/` (login, signup, password reset, email verification)
- Custom `OptionalDjangoAuth` class allows anonymous access while providing user context
- CSRF token required for unsafe methods (fetched via `/api/set-csrf-token`)

---

## Frontend Patterns

### File Structure
```
src/
├── app/           # Next.js App Router pages
├── components/    # Reusable React components
│   ├── ui/        # shadcn/ui primitives
│   └── navigation/
├── lib/
│   ├── api/       # Orval-generated hooks (DO NOT EDIT)
│   ├── models/    # Orval-generated TypeScript types (DO NOT EDIT)
│   ├── hooks/     # Custom hooks
│   │   └── ws/    # WebSocket hooks and manager
│   ├── fetchClient.ts  # Custom fetch wrapper with CSRF + SSR cookie forwarding
│   └── utils.ts
├── providers/     # React context providers
│   ├── authProvider.tsx  # Auth state management
│   └── providers.tsx     # Root provider composition
```

### API Client Pattern
- **Orval** generates typed hooks from `openapi.json`
- Custom `fetchClient.ts` handles:
  - CSRF token injection for POST/PUT/PATCH/DELETE
  - Server-side cookie forwarding for SSR
  - Different API URLs for server vs client (`DOCKER_API_URL` vs `NEXT_PUBLIC_API_URL`)

### Authentication Context
`AuthProvider` exposes:
- `authStatus`: `"loading" | "authenticated" | "unauthenticated"`
- `user`: Current user info (when authenticated)
- `login`, `logout`, `invalidateUser` actions

Usage:
```typescript
const { authStatus, user } = useAuthState();
const { logout } = useAuthActions();
```

### WebSocket Integration
Single `WebSocketManager` (singleton) manages connection:
```typescript
const { send, connectionStatus } = useWebSocket({
  stream: "discussion",
  onMessage: (msg) => { ... }
});
```

Message format matches backend demultiplexer:
```typescript
send({ event_type: "new_message", data: { discussion_id: 1, message: "Hello" } });
```

### Data Fetching Pattern
- Server-side prefetch in layouts/pages via `queryClient.prefetchQuery`
- Hydration via `HydrationBoundary` in `providers.tsx`
- Client-side mutations invalidate relevant queries

---

## Key Commands

### Development
```bash
# Start full dev environment (Docker)
./dev.sh

# Or manually:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Backend only (local Python)
cd backend
python manage.py runserver

# Frontend only
cd frontend
npm run dev
```

### Database
```bash
# Migrations
docker exec debate-backend python manage.py makemigrations
docker exec debate-backend python manage.py migrate

# Create superuser
docker exec -it debate-backend python manage.py createsuperuser

# Django shell
docker exec -it debate-backend python manage.py shell_plus  # ipython with auto-imports
```

### Celery
```bash
# Run worker (dev)
celery -A ProjectOpenDebate worker -l debug --pool=solo

# Run beat (dev)
celery -A ProjectOpenDebate beat -l debug

# Both via Docker already run in docker-compose.dev.yml
```

### API Schema Generation
```bash
# Generate OpenAPI schema from Django
cd backend
python scripts/create_openapi_schema.py

# Copy to frontend and regenerate hooks
cp backend/env/openapi.json frontend/openapi.json
cd frontend
npx orval
```

### Testing
```bash
# Backend tests
docker exec debate-backend python manage.py test

# Frontend lint
cd frontend
npm run lint
```

### Production
```bash
# Build production images
./build_prod_image.sh

# Deploy (blue-green)
./deploy.sh

# Collect static files
docker exec debate-backend python manage.py collectstatic --noinput
```

---

## Critical Implementation Notes

### Adding a New API Endpoint
1. Create/update schema in `schemas.py` (use `ModelSchema` when possible)
2. Add route in `api.py` with appropriate auth (`django_auth` or `optional_django_auth`)
3. Put business logic in `services.py`
4. Regenerate OpenAPI: `python scripts/create_openapi_schema.py`
5. Copy to frontend and run `npx orval`

### Adding a WebSocket Event
1. Add handler method in relevant `consumers.py`
2. Register in `event_handlers` dict
3. Use `await self.send_event(user_id, 'event_name', data)` to broadcast
4. Frontend: handle in `onMessage` callback of `useWebSocket` hook

### Database Considerations
- Use `select_related` and `prefetch_related` for N+1 prevention
- Annotate computed fields via subqueries in QuerySets
- Use `transaction.atomic` for multi-model operations
- `pg_advisory_xact_lock` for concurrent writes requiring serialization (see `pairing/services.py`)

### Frontend State Sync
- WebSocket events should trigger TanStack Query cache invalidation or optimistic updates
- Use `queryClient.setQueryData` for optimistic updates
- Use `queryClient.invalidateQueries` for refetch after mutations

### Environment Variables
Backend (`.env`):
- `ENV`: `dev` or `prod`
- `SECRET_KEY`, `POSTGRES_*`, `REDIS_*`
- `FRONTEND_URL` for allauth email links
- `EMAIL_*` for SMTP config

Frontend (`.env.local`):
- `NEXT_PUBLIC_API_URL`: Client-side API base (e.g., `http://localhost:8000`)
- `DOCKER_API_URL`: Server-side API base (e.g., `http://backend:8000`)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (e.g., `ws://localhost:8000/ws/`)

