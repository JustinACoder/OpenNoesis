---
applyTo: "frontend/**/*.{ts,tsx}"
---

# Frontend Patterns

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## API Client Pattern

**Orval** generates typed hooks from `openapi.json` into `lib/api/` and `lib/models/`.

> ⚠️ **DO NOT EDIT** files in `lib/api/` or `lib/models/` - they are auto-generated.

The custom `fetchClient.ts` handles:
- CSRF token injection for POST/PUT/PATCH/DELETE
- Server-side cookie forwarding for SSR
- Different API URLs for server vs client

```typescript
// fetchClient.ts determines API URL based on environment
function getApiUrl() {
  if (isServer) return process.env.DOCKER_API_URL;      // Server-side: http://backend:8000
  return process.env.NEXT_PUBLIC_API_URL || "";          // Client-side: http://localhost:8000
}
```

---

## Authentication Context

`AuthProvider` in `providers/authProvider.tsx` manages auth state:

```typescript
// Usage in components
const { authStatus, user } = useAuthState();
// authStatus: "loading" | "authenticated" | "unauthenticated"
// user: SessionUserInfo | undefined

const { login, logout, invalidateUser } = useAuthActions();
// login: mutation hook from Orval (ultimately)
// logout: mutation hook from Orval (ultimately)
// invalidateUser: invalidates session and user queries
```

**Provider Hierarchy** (in `providers/providers.tsx`):
```
QueryClientProvider
  └── HydrationBoundary
        └── AuthProvider
              └── {children}
```

---

## Data Fetching Pattern

### Client-Side Usage

```typescript
// In client component
"use client";

import { useGetSomeData } from "@/lib/api/someApi";

export function ClientComponent() {
  const { data, isLoading, error } = useGetSomeData();
  // Data is already hydrated from SSR
}
```

### Mutations with Cache Invalidation

```typescript
const queryClient = useQueryClient();
const mutation = useCreateSomething();

const handleSubmit = async (data) => {
  await mutation.mutateAsync(data);
  queryClient.invalidateQueries({ queryKey: getSomeListQueryKey() });
};
```

---

## Component Patterns

### UI Components

Using **shadcn/ui** components from `components/ui/`:

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
```

### Client-Side Auth Gates

```typescript
import { ClientAuthGate } from "@/components/ClientAuthGate";

// Only renders children when authenticated
<ClientAuthGate>
  <ProtectedContent />
</ClientAuthGate>
```

---

## Environment Variables

Frontend `.env`:

```env
# Server-side API base URL (for SSR in Docker)
DOCKER_API_URL=http://backend:8000
```

Note that `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are also available but
are defined in <root>/.env file as they are needed by docker compose to build images at build time.
When dev.sh is used, these variables are accessed during runtime as they are loaded in the container environment.

---

## Common Imports

```typescript
// API hooks (Orval-generated)
import { useGetDebates, getGetDebatesQueryKey } from "@/lib/api/debate";

// Models (Orval-generated)
import type { DebateSchema, UserSchema } from "@/lib/models";

// Auth context
import { useAuthState, useAuthActions } from "@/providers/authProvider";

// TanStack Query
import { useQueryClient } from "@tanstack/react-query";
```

