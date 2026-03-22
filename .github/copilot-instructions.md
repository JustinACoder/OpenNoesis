# AI Agent Instructions for ProjectOpenDebate

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately to reflect the current state of the project.

OpenNoesis is a real-time debate platform with a Django + Channels backend and Next.js 15 frontend.

---

## Instruction Files

Read the relevant files based on your task:

| File | When to Read |
|------|-------------|
| [backend-patterns.instructions.md](./instructions/backend-patterns.instructions.md) | When working on Django, APIs, services, models |
| [frontend-patterns.instructions.md](./instructions/frontend-patterns.instructions.md) | When working on Next.js, React, UI components |
| [websocket-patterns.instructions.md](./instructions/websocket-patterns.instructions.md) | When working on real-time features |
| [commands.instructions.md](./instructions/commands.instructions.md) | When running dev/build/deploy commands |
| [workflows.instructions.md](./instructions/workflows.instructions.md) | When adding new features end-to-end |
| [infrastructure-patterns.instructions.md](./instructions/infrastructure-patterns.instructions.md) | When modifying Docker, compose files, deploy/rollback scripts, nginx |
| [monitoring-patterns.instructions.md](./instructions/monitoring-patterns.instructions.md) | When adding or modifying metrics and monitoring infrastructure |

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
| django-anymail + Resend + django-post-office | Transactional email via HTTP API with queued delivery |

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

### Running Commands in Development

**Important**: All development commands should be run through Docker containers, not directly on the host.

**Container Names:**
- `debate-backend` - Django backend
- `debate-frontend` - Next.js frontend  
- `debate-db` - PostgreSQL database
- `debate-redis` - Redis cache
- `debate-celery-worker` - Celery worker
- `debate-celery-beat` - Celery beat scheduler

**Backend Commands:**
```bash
# General pattern
docker exec debate-backend <command>

# Examples
docker exec debate-backend python manage.py migrate
docker exec debate-backend python manage.py makemigrations
docker exec debate-backend python manage.py createsuperuser
docker exec -it debate-backend python manage.py shell_plus
./test.sh
./test.sh debate.tests.DebateCreationEndpointsTest
```

**Frontend Commands:**
```bash
# General pattern
docker exec debate-frontend <command>

# Examples
docker exec debate-frontend npm run lint
docker exec debate-frontend npm run build
docker exec debate-frontend npm test
docker exec -it debate-frontend npm install <package>
```

**Other Containers:**
```bash
# PostgreSQL shell
docker exec -it debate-db psql -U postgres -d debate_db

# Redis CLI
docker exec -it debate-redis redis-cli

# View logs
docker logs debate-backend
docker logs debate-frontend
docker logs debate-celery-worker
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

## CI/CD (GitHub Actions)

### Workflows (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `django.yml` | Push/PR to `dev`, `master` | Runs Django tests via `docker-compose.test.yml` |
| `deploy.yml` | Push to `master` | Builds & pushes images to ghcr.io, then deploys to production (requires manual approval) |

### Image Tagging

Images are pushed to `ghcr.io/justinacoder/debate-backend` and `ghcr.io/justinacoder/debate-frontend` with:
- **Versioned tag**: `YYYY-MM-DD_<short-sha>` (e.g., `2026-02-22_a1b2c3d`) — matches the `APP_TAG` convention used by `deploy.sh` and `rollback.sh`
- **`latest` tag**: Always points to the most recent master build

### Deploy Approval

The `deploy` job uses a GitHub Actions **environment** called `production` with required reviewers. After images are built, the deploy job will pause and wait for manual approval before SSHing into the VPS and running `deploy.sh`.

**Required setup in GitHub → Settings → Environments → `production`:**
- Add required reviewers
- Add environment secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

**Required setup in GitHub → Settings → Actions → Variables (repository-level):**
- `NEXT_PUBLIC_WS_URL`: Production WebSocket URL (e.g., `wss://opennoesis.com/ws/`)
- `NEXT_PUBLIC_API_URL`: **Do not create this variable.** Leaving it unset makes API calls relative to the current domain, which is the correct behavior behind a reverse proxy. Only create it if you need to override the default.

---

## Environment Variables

**Root folder** (used by docker compose for build-time args):
- `.env.dev`: Development environment variables (used by `./dev.sh`)
- `.env.prod`: Production environment variables (used by `./build_prod_image.sh` and `./prod.sh`)
- Contains `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` needed at docker compose build time

**Backend** (`backend/.env`):
- `ENV`: `dev` or `prod`
- `SECRET_KEY`, `POSTGRES_*`, `REDIS_*`
- `FRONTEND_URL` for allauth email links
- `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, and optional `POST_OFFICE_DELIVERY_BACKEND` for Anymail-based email delivery
- See `backend/.env.example` for full list

**Frontend** (`frontend/.env`):
- `DOCKER_API_URL`: Server-side API base (e.g., `http://backend:8000`)
