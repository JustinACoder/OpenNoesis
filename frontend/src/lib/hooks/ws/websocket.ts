import { useEffect, useRef, useCallback, useState } from "react";
import WebSocketManager, { WebSocketMessage } from "./websocketManager";
import { toast } from "sonner";
import { useAuth } from "@/providers/authProvider";

interface UseWebSocketOptions {
  stream?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (event: Event) => void;
  autoConnect?: boolean;
}

export function useWebSocket({
  stream,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoConnect = true,
}: UseWebSocketOptions) {
  const manager = useRef(WebSocketManager.getInstance());
  const cleanupFns = useRef<Array<() => void>>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "disconnecting"
  >(manager.current.getStatus());
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);
  const { authStatus } = useAuth();

  useEffect(() => {
    if (authStatus !== "authenticated") {
      console.warn("WebSocket not connecting: user not authenticated");
      return;
    }

    // Register handlers
    if (onMessage) {
      if (stream) {
        // Use stream-specific handler
        cleanupFns.current.push(
          manager.current.addStreamHandler(stream, onMessage),
        );
      } else {
        // Use general message handler
        cleanupFns.current.push(manager.current.addMessageHandler(onMessage));
      }
    }

    if (onConnect) {
      cleanupFns.current.push(
        manager.current.subscribe("connected", onConnect),
      );
    }

    if (onDisconnect) {
      cleanupFns.current.push(
        manager.current.subscribe("disconnected", onDisconnect),
      );
    }

    if (onError) {
      cleanupFns.current.push(manager.current.subscribe("error", onError));
    }

    // Always subscribe to update local status
    cleanupFns.current.push(
      manager.current.subscribe("connected", () =>
        setConnectionStatus("connected"),
      ),
    );
    cleanupFns.current.push(
      manager.current.subscribe("disconnected", () =>
        setConnectionStatus("disconnected"),
      ),
    );
    cleanupFns.current.push(
      manager.current.subscribe("error", () =>
        toast.error(
          `Oops! There was an error when communicating with the server. If you are experiencing issues, please try refreshing the page.`,
        ),
      ),
    );
    cleanupFns.current.push(
      manager.current.subscribe("connecting", () => {
        setConnectionStatus("connecting");
        setHasAttemptedConnection(true);
      }),
    );
    cleanupFns.current.push(
      manager.current.subscribe("disconnecting", () =>
        setConnectionStatus("disconnecting"),
      ),
    );

    // Auto-connect if enabled
    if (autoConnect) {
      manager.current.connect();
    }

    // Cleanup function
    return () => {
      cleanupFns.current.forEach((cleanup) => cleanup());
      cleanupFns.current = [];
    };
  }, [
    stream,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect,
    authStatus,
  ]);

  const connect = useCallback(() => {
    manager.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    manager.current.disconnect();
  }, []);

  const send = useCallback(
    (data: any) => {
      manager.current.send(data, stream);
    },
    [stream],
  );

  return {
    connect,
    disconnect,
    send,
    connectionStatus,
    hasAttemptedConnection,
  };
}
