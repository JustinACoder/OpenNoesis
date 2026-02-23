# OpenNoesis

OpenNoesis is a real-time debate platform where users can engage in structured debates, get matched with opponents through a pairing system, and participate in topic-based discussions — all powered by WebSockets for a live experience.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Django 5.2, Django Ninja, Django Channels, Celery, PostgreSQL, Redis |
| **Frontend** | Next.js 15, React 19, TypeScript, TanStack Query, shadcn/ui, TailwindCSS |

## Project Structure

```
├── backend/                # Django backend (ASGI via Daphne)
│   ├── debate/             # Core debate functionality
│   ├── discussion/         # Discussions (with real-time WebSocket)
│   ├── debateme/           # Debate invitations
│   ├── pairing/            # Matchmaking system
│   ├── notifications/      # User notifications (real-time)
│   ├── users/              # User management
│   └── ProjectOpenDebate/  # Django project settings, routing, ASGI
├── frontend/               # Next.js 15 App Router frontend
│   └── src/
│       ├── app/            # Pages (App Router)
│       ├── components/     # React components
│       └── lib/            # API hooks (Orval-generated), utilities, WebSocket hooks
├── docker-compose*.yml     # Docker Compose configs (dev, prod, test, build)
├── dev.sh                  # Start local dev environment
├── deploy.sh               # Production deployment (with maintenance mode + auto-rollback)
└── .github/                # CI/CD workflows & AI agent instructions
```

## Development

1. Copy the example env files and fill them in:
   ```
   .env.example       → .env.dev
   backend/.env.example → backend/.env
   frontend/.env.example → frontend/.env
   ```

2. Start everything:
   ```bash
   ./dev.sh
   ```

That's it. This spins up all services (Django, Next.js, PostgreSQL, Redis, Celery) with live reloading via Docker Compose.

For detailed patterns, commands, and workflows, see the [instructions files](.github/instructions/).

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## License

[PolyForm Strict License 1.0.0](./LICENSE)
