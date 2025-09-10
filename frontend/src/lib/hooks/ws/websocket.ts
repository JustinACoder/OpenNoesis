import { useEffect, useRef, useCallback, useState } from "react";
import WebSocketManager, { WebSocketMessage } from "./websocketManager";

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

  // New reactive status state
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "disconnecting"
  >(manager.current.getStatus());

  useEffect(() => {
    // Auto-connect if enabled
    if (autoConnect) {
      manager.current.connect();
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
      manager.current.subscribe("error", (err) => console.error(err)),
    );
    cleanupFns.current.push(
      manager.current.subscribe("connecting", () =>
        setConnectionStatus("connecting"),
      ),
    );
    cleanupFns.current.push(
      manager.current.subscribe("disconnecting", () =>
        setConnectionStatus("disconnecting"),
      ),
    );

    // Cleanup function
    return () => {
      cleanupFns.current.forEach((cleanup) => cleanup());
      cleanupFns.current = [];
    };
  }, [stream, onMessage, onConnect, onDisconnect, onError, autoConnect]);

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
  };
}
