---
applyTo: "**/*consumer*.py,**/ws/**,**/*websocket*"
---

# WebSocket Patterns

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## Architecture Overview

Single WebSocket endpoint: `/ws/`

A **demultiplexer** (`ProjectOpenDebate/demultiplexer.py`) routes messages by `stream` field to different consumers.

**Streams**: `discussion`, `notification`, `pairing`

---

## Backend Consumer Pattern

### Key Base Consumer Methods

```python
# Send error to current client
await self.send_error('Error message', details=extra_info)

# Send success to current client
await self.send_success('event_type', {'data': 'here'})

# Send event to specific user (broadcasts to their group)
await self.send_event(user_id, 'event_type', {'data': 'here'})
```

### User Group Naming

```python
# Format: {ConsumerClassName}_{user_id}
group_name = get_user_group_name('DiscussionConsumer', user.id)
# Result: "DiscussionConsumer_123"
```

---

## Message Format

### Client → Server (through demultiplexer)

```json
{
  "stream": "discussion",
  "payload": {
    "event_type": "new_message",
    "data": {
      "discussion_id": 1,
      "message": "Hello world"
    }
  }
}
```

### Server → Client (through demultiplexer)

```json
{
  "stream": "discussion",
  "payload": {
    "status": "success",
    "event_type": "new_message",
    "data": {
      "message": { /* MessageSchema */ }
    }
  }
}
```

---

## Frontend WebSocket Pattern

Singleton `WebSocketManager` in `lib/hooks/ws/websocketManager.ts`:

```typescript
const wsManager = WebSocketManager.getInstance();

// Connect
wsManager.connect();

// Add handler for specific stream
wsManager.addStreamHandler("discussion", (payload) => {
  console.log(payload.event_type, payload.data);
});

// Send message
wsManager.send("discussion", {
  event_type: "new_message",
  data: { discussion_id: 1, message: "Hello" }
});
```

### Stream-Specific Hooks

Each stream has a dedicated manager and hook:

```typescript
// lib/hooks/ws/discussionWebsocket.ts
export function useDiscussionWebSocket(options: UseDiscussionWebSocketOptions) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const manager = DiscussionWebSocketManager.getInstance();
    manager.setQueryClient(queryClient);
    manager.initialize(options.discussionId);
    // ...
  }, []);

  const sendMessage = useCallback((message: string) => {
    wsManager.send("discussion", {
      event_type: "new_message",
      data: { discussion_id: options.discussionId, message }
    });
  }, [options.discussionId]);

  return { sendMessage, connectionStatus };
}
```

However, at all times, there is only one WebSocket connection managed by `WebSocketManager`.
This connection is shared across all stream managers and is only up when at least one stream manager is initialized.
This also requires the user to be authenticated (websocket is not allowed for anonymous users).

### Cache Invalidation on WebSocket Events

```typescript
private handleMessage(payload: WebSocketMessage): void {
  if (payload.event_type === "new_message") {
    // Update TanStack Query cache
    this.queryClient?.setQueryData(
      getDiscussionMessagesQueryKey(discussionId),
      (old) => insertMessage(old, payload.data.message)
    );
  }
}
```

---

## Adding a New WebSocket Event

### Backend

1. Add handler method in relevant `consumers.py`:
   ```python
   async def handle_my_event(self, data):
       payload = MyEventPayload(**data)
       # Process...
       await self.send_event(user_id, 'my_event', result_data)
   ```

2. Register in `event_handlers` dict:
   ```python
   event_handlers = {
       'my_event': 'handle_my_event',
       # ...existing handlers
   }
   ```

3. Create Pydantic schema for payload validation in `schemas.py`

### Frontend

Handle in stream manager's `handleMessage`:
```typescript
if (payload.event_type === "my_event") {
 // Update cache or trigger callback
}
```

