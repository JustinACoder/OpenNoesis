# AI Agent Instructions for ProjectOpenDebate

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately to reflect the current state of the project.

ProjectOpenDebate is a real-time debate platform with a Django + Channels backend and Next.js 15 frontend.

---

## Instruction Files

Read the relevant files based on your task:

| File | When to Read |
|------|-------------|
| [backend-patterns.md](./instructions/backend-patterns.md) | When working on Django, APIs, services, models |
| [frontend-patterns.md](./instructions/frontend-patterns.md) | When working on Next.js, React, UI components |
| [websocket-patterns.md](./instructions/websocket-patterns.md) | When working on real-time features |
| [commands.md](./instructions/commands.md) | When running dev/build/deploy commands |
| [workflows.md](./instructions/workflows.md) | When adding new features end-to-end |

---

## Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Django 5.2 | Web framework |
| Django Ninja | REST API with type hints + Pydantic schemas |
| Django Channels + Daphne | WebSocket support via ASGI |
| Celery + Redis | Async task queue with django-celery-beat |
| PostgreSQL | Database (GIN indexes, advisory locks, full-text search) |
| django-allauth | Authentication (headless mode, session-based) |

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router, React Server Components |
| React 19 | UI library |
| TypeScript | Type safety |
| TanStack Query v5 | Data fetching, caching, hydration |
| Orval | Auto-generates API hooks from OpenAPI schema |
| shadcn/ui + TailwindCSS v4 | UI components and styling |
| Zod + react-hook-form | Form validation |

---

## Key Patterns

- Service layer in `services.py` for business logic
- QuerySet annotations for computed fields
- WebSocket demultiplexer at `/ws/` with stream routing
- Orval-generated API hooks (DO NOT EDIT `lib/api/` or `lib/models/`)

---

## Project Structure

### Django Apps

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

### Frontend

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
│   ├── fetchClient.ts  # Custom fetch wrapper with CSRF + SSR
│   └── utils.ts
├── providers/     # React context providers
│   ├── authProvider.tsx  # Auth state management
│   └── providers.tsx     # Root provider composition
├── styles/        # Global styles
```

### API Routes

Backend routers in `ProjectOpenDebate/urls.py`:
- `/api/discussions` - Discussion endpoints
- `/api/invites` - Debate invites
- `/api/debates` - Debate endpoints
- `/api/notifications` - Notifications
- `/api/users` - User endpoints
- `/api/pairing` - Pairing system
- `/admin/` - Django admin
- `/_allauth/` - Authentication (login, signup, etc.)

---

## Essential Commands

### Development

```bash
# Start full dev environment (Docker)
./dev.sh
```

### Production

```bash
# Build production images
./build_prod_image.sh

# Run production locally (need .env files to have the right vars)
./prod.sh

# Deploy (will set a migration page temporarily during deployment)
# If the deployment fails, it rollbacks automatically
./deploy.sh

# Rollback manually if needed somehow
./rollback.sh
```

### Database

```bash
# Create migrations
docker exec debate-backend python manage.py makemigrations

# Apply migrations
docker exec debate-backend python manage.py migrate

# Django shell
docker exec -it debate-backend python manage.py shell_plus
```

### API Schema Generation

```bash
# Regenerate OpenAPI schema file
./apply_openai
```

This private script basically builds the docker compose, then runs the containers, 
then runs the commands to generate the OpenAPI schema, copy it to frontend, and run orval.
So, when making changes to the backend API that affect the schema, just run this script afterwards.

---

## Environment Variables

**Backend** (`.env`):
- `ENV`: `dev` or `prod`
- `SECRET_KEY`, `POSTGRES_*`, `REDIS_*`
- `FRONTEND_URL` for allauth email links
- `EMAIL_*` for SMTP config
- See `backend/.env.example` for full list

**Frontend** (`.env`):
- `DOCKER_API_URL`: Server-side API base (e.g., `http://backend:8000`)

**Global** (`.env`):
- `NEXT_PUBLIC_API_URL`: Client-side API base (e.g., `http://localhost:8000`) needed at docker compose build time
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (e.g., `ws://localhost:8000/ws/`) needed at docker compose build time
