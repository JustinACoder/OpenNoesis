---
applyTo: "*.sh,docker-compose*.yml,Dockerfile*"
---

# Commands Reference

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## Development

### Start Full Dev Environment (Docker)

```bash
./dev.sh
```

---

## Database

### Migrations

```bash
# Create migrations
docker exec debate-backend python manage.py makemigrations

# Apply migrations
docker exec debate-backend python manage.py migrate
```

### Admin & Shell

```bash
# Create superuser
docker exec -it debate-backend python manage.py createsuperuser

# Django shell (with auto-imports via shell_plus)
docker exec -it debate-backend python manage.py shell_plus
```

---

## Celery

Both 'beat' and 'worker' run automatically in development and production via Docker Compose.

---

## API Schema Generation

This is the pipeline to update frontend API hooks after backend changes:

```bash
./myscripts/apply_openapi
```

> ⚠️ After running `npx orval` (through the above command), the `lib/api/` and `lib/models/` directories are regenerated. DO NOT manually edit these files.

---

## Testing

### Backend

```bash
# Full suite in isolated Docker test stack
./test.sh

# Targeted tests in isolated Docker test stack
./test.sh debate.tests.DebateCreationEndpointsTest

# You can pass multiple targets too
./test.sh debate.tests users.tests
```

---

## Production

### Build Images

```bash
./build_prod_image.sh
```

### Deploy (with automatic migration page and rollback)

```bash
./deploy.sh
```

### Static Files

```bash
docker exec debate-backend python manage.py collectstatic --noinput
```

### Maintenance Mode

```bash
./maintenance.sh on   # Enable maintenance page
./maintenance.sh off  # Disable maintenance page
```

### Manual rollback

```bash
./rollback.sh
```

---

## Container Access

```bash
# Backend shell
docker exec -it debate-backend bash

# Frontend shell
docker exec -it debate-frontend sh

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f celery-worker
```
