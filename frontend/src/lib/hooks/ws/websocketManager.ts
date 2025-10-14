export interface WebSocketMessage {
  status: "success" | "error";
  event_type?: string;
  message?: string;
  data?: any;
  [key: string]: any;
}

type MessageHandler = (payload: WebSocketMessage) => void;
type EventHandler = (...args: any[]) => void;

class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private url: string = "ws://localhost:8000/ws/";
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private streamHandlers: Map<string, Set<MessageHandler>> = new Map();
  private eventSubscribers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  connect(): void {
    // If already connected, do nothing
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If connecting, wait
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.emit("connecting");
    this.createConnection();
  }

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const rawMessage = JSON.parse(event.data);

          // Handle demultiplexer format with stream routing
          if (rawMessage.stream && rawMessage.payload) {
            const stream = rawMessage.stream;
            const payload = rawMessage.payload;

            // Call stream-specific handlers
            const streamHandlers = this.streamHandlers.get(stream);
            if (streamHandlers) {
              streamHandlers.forEach((handler) => {
                try {
                  handler(payload);
                } catch (error) {
                  console.error(
                    `Error in stream handler for ${stream}:`,
                    error,
                  );
                }
              });
            }
          }

          // Also call general message handlers for backward compatibility
          this.messageHandlers.forEach((handler) => {
            try {
              handler(rawMessage);
            } catch (error) {
              console.error("Error in message handler:", error);
            }
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnecting = false;
        this.emit("error", error);
        this.ws?.close();
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.emit("disconnected");
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.isConnecting = false;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.emit("reconnectFailed");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageHandlers.clear();
    this.streamHandlers.clear();
    this.eventSubscribers.clear();
    this.reconnectAttempts = 0;
  }

  send(data: any, stream?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      let message;
      if (stream) {
        // Format message for demultiplexer
        message = {
          stream: stream,
          payload: data,
        };
      } else {
        message = data;
      }
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn(
        "WebSocket is not connected. Message not sent: " + data.toString(),
      );
      // Optionally queue messages to send when reconnected
    }
  }

  // Register a message handler (for raw WebSocket messages)
  addMessageHandler(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);

    // Return cleanup function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  // Register a handler for a specific stream
  addStreamHandler(stream: string, handler: MessageHandler): () => void {
    if (!this.streamHandlers.has(stream)) {
      this.streamHandlers.set(stream, new Set());
    }

    this.streamHandlers.get(stream)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = this.streamHandlers.get(stream);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.streamHandlers.delete(stream);
        }
      }
    };
  }

  // Subscribe to custom events (for higher-level abstractions)
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.eventSubscribers.has(event)) {
      this.eventSubscribers.set(event, new Set());
    }

    this.eventSubscribers.get(event)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = this.eventSubscribers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventSubscribers.delete(event);
        }
      }
    };
  }

  // Emit custom events
  emit(event: string, ...args: any[]): void {
    const handlers = this.eventSubscribers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  getStatus(): "connecting" | "connected" | "disconnecting" | "disconnected" {
    if (this.ws) {
      switch (this.ws.readyState) {
        case WebSocket.CONNECTING:
          return "connecting";
        case WebSocket.OPEN:
          return "connected";
        case WebSocket.CLOSING:
          return "disconnecting";
        case WebSocket.CLOSED:
          return "disconnected";
      }
    }
    return "disconnected";
  }
}

export default WebSocketManager;
