---
applyTo: "**/*.{py,ts,tsx}"
---

# Feature Workflows

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## Adding a New API Endpoint

### 1. Create/Update Schema (`schemas.py`)

```python
from ninja import ModelSchema, Schema

class MyInputSchema(Schema):
    field1: str
    field2: int

class MyOutputSchema(ModelSchema):
    class Meta:
        model = MyModel
        fields = ['id', 'field1', 'field2']
```

### 2. Add Business Logic (`services.py`)

```python
class MyService:
    @staticmethod
    def do_something(user: User, data: MyInputSchema) -> MyModel:
        return MyModel.objects.create(author=user, **data.dict())
```

### 3. Add Route (`api.py`)

```python
from ninja.security import django_auth

@router.post("/my-endpoint", response=MyOutputSchema, auth=django_auth)
def create_my_thing(request, payload: MyInputSchema):
    return MyService.do_something(request.auth, payload)
```

### 4. Regenerate Frontend Hooks

```bash
./myscripts/apply_openapi
```

### 5. Use in Frontend

```typescript
import { usePostMyEndpoint } from "@/lib/api/myApi";

const mutation = usePostMyEndpoint();
await mutation.mutateAsync({ field1: "value", field2: 42 });
```

---

## Adding a New WebSocket Event

### Backend

1. **Add Pydantic schema** in `schemas.py`:
   ```python
   class MyEventPayload(Schema):
       target_id: int
       action: str
   ```

2. **Add handler** in `consumers.py`:
   ```python
   async def handle_my_event(self, data):
       payload = MyEventPayload(**data)
       # Process...
       await self.send_event(user_id, 'my_event_response', result)
   ```

3. **Register handler**:
   ```python
   event_handlers = {
       'my_event': 'handle_my_event',
   }
   ```

### Frontend

**Handle in stream manager** (`lib/hooks/ws/myWebsocket.ts`):
```typescript
if (payload.event_type === "my_event_response") {
  // Update cache or call callback
}
```

If the event stream is new, you will need to add a new stream manager similar to existing ones.

---

## Adding a New Django App

```bash
cd backend
python manage.py startapp myapp
```

### Create Required Files

```
myapp/
├── api.py        # Router definition
├── schemas.py    # Pydantic schemas
├── services.py   # Business logic
├── models.py     # ORM models
├── querysets.py  # Custom QuerySets (if needed)
├── consumers.py  # WebSocket consumers (if needed)
├── tasks.py      # Celery tasks (if needed)
```

### Register App

1. Add to `INSTALLED_APPS` in `settings.py`
2. Add router in `urls.py`:
   ```python
   from myapp.api import router as myapp_router
   api.add_router('/myapp', myapp_router, tags=['MyApp'])
   ```

---

## Adding a New Frontend Page

### 1. Create Page File

```
src/app/my-page/page.tsx
```

### 2. Write Page Component
Keep it as server component by default; use `"use client";` if client-side is needed.

```typescript
"use client";

export function MyPage() {
  const { data } = useGetMyData();
  return <div>{/* UI */}</div>;
}
```

Make sure that a single/few small parts requiring client-side behavior are isolated into client components if 
the page is mostly server-rendered.

---

## Database Migration Workflow

```bash
# 1. Make changes to models.py

# 2. Create migration
docker exec debate-backend python manage.py makemigrations

# 3. Review migration file in migrations/

# 4. Apply migration
docker exec debate-backend python manage.py migrate

# 5. If schema affects API, regenerate OpenAPI
./myscripts/apply_openapi
```

---

## Common Gotchas

1. **CSRF Token**: Required for all unsafe methods (POST, PUT, PATCH, DELETE). The `fetchClient.ts` handles this automatically.

2. **QuerySet Annotations**: Schema fields like `vote_score` must have matching annotations in the QuerySet. Check `services.py` returns properly annotated QuerySets.

3. **WebSocket Auth**: Consumers require authentication. The `CustomBaseConsumer` automatically rejects unauthenticated connections.

4. **SSR API URLs**: Server-side rendering uses `DOCKER_API_URL` (internal Docker network), client-side uses `NEXT_PUBLIC_API_URL`.

5. **Orval Files**: Never edit `lib/api/` or `lib/models/` - changes will be overwritten by `npx orval`.

