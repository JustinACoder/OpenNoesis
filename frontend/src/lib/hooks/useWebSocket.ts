import { useCallback, useEffect, useRef, useState } from "react";

export interface WebSocketMessage {
  status: "success" | "error";
  event_type?: string;
  message?: string;
  data?: any;
  [key: string]: any;
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  stream: string; // Required for demultiplexer
}

export const useWebSocket = (url: string, options: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Check the readyState before closing to avoid the error
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
        // If still connecting, wait a bit and then close
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
            wsRef.current.close();
          }
        }, 100);
      } else if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't create a new connection if one is already connecting
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const {
      onConnect,
      onMessage,
      onDisconnect,
      onError,
      reconnectAttempts = 5,
      reconnectDelay = 3000,
      stream,
    } = optionsRef.current;

    setConnectionStatus("connecting");

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const rawMessage = JSON.parse(event.data);

          // Handle demultiplexer format
          if (rawMessage.stream === stream && rawMessage.payload) {
            const message: WebSocketMessage = rawMessage.payload;
            onMessage?.(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus("disconnected");
        onDisconnect?.();

        // Only attempt to reconnect if we haven't exceeded the limit and component is still mounted
        // Also check if the close wasn't intentional (code 1000 is normal closure)
        if (
          reconnectAttemptsRef.current < reconnectAttempts &&
          mountedRef.current &&
          event.code !== 1000
        ) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectDelay);
        }
      };

      wsRef.current.onerror = (error) => {
        if (!mountedRef.current) return;
        setConnectionStatus("error");
        onError?.(error);
      };
    } catch (error) {
      if (!mountedRef.current) return;
      setConnectionStatus("error");
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [url]); // Only depend on URL

  const sendMessage = useCallback(
    (message: { event_type: string; data?: any }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Format message for demultiplexer
        const demultiplexedMessage = {
          stream: optionsRef.current.stream,
          payload: message,
        };
        wsRef.current.send(JSON.stringify(demultiplexedMessage));
        return true;
      }
      return false;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    // Add a small delay to prevent rapid connection attempts during development
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      disconnect();
    };
  }, [connect, disconnect, url]); // Only reconnect when URL changes

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
  };
};
