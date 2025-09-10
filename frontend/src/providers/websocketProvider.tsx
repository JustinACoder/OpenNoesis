// Optional: WebSocketProvider.tsx
// This is an optional enhancement that provides centralized WebSocket management
// and connection status at the app level

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import WebSocketManager from "@/lib/hooks/ws/websocketManager";

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts: number;
  lastError: Error | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
  autoConnect?: boolean;
}

export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketContextType["connectionStatus"]>("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  useEffect(() => {
    const manager = WebSocketManager.getInstance();

    // Subscribe to connection events
    const unsubscribeConnected = manager.subscribe("connected", () => {
      setIsConnected(true);
      setConnectionStatus("connected");
      setReconnectAttempts(0);
      setLastError(null);
    });

    const unsubscribeDisconnected = manager.subscribe("disconnected", () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
    });

    const unsubscribeError = manager.subscribe("error", (error) => {
      setConnectionStatus("error");
      setLastError(error);
    });

    const unsubscribeReconnecting = manager.subscribe(
      "reconnecting",
      (attempt: number) => {
        setConnectionStatus("connecting");
        setReconnectAttempts(attempt);
      },
    );

    // Auto-connect if enabled
    if (autoConnect) {
      manager.connect(url);
    }

    // Cleanup
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
      unsubscribeReconnecting();
    };
  }, [url, autoConnect]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        connectionStatus,
        reconnectAttempts,
        lastError,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook to access WebSocket context
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider",
    );
  }
  return context;
}
