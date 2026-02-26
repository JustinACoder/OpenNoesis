import { useEffect, useRef, useCallback, useState } from "react";
import WebSocketManager, { WebSocketMessage } from "./websocketManager";
import { toast } from "sonner";
import { useAuthState } from "@/providers/authProvider";
import { useEvent } from "@/lib/hooks/useEvent";

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
  console.log("useWebSocket called");
  // Lazy singleton initialization - only calls getInstance once
  const managerRef = useRef<WebSocketManager | null>(null);
  const getManager = useCallback(() => {
    if (managerRef.current === null) {
      managerRef.current = WebSocketManager.getInstance();
    }
    return managerRef.current;
  }, []);

  const cleanupFns = useRef<Array<() => void>>([]);
  // Initialize with current status - getInstance() is idempotent so this is safe
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "disconnecting"
  >(() => WebSocketManager.getInstance().getStatus());
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);
  const { authStatus } = useAuthState();

  // Stable callback references that always call the latest version
  const handleMessage = useEvent(onMessage);
  const handleConnect = useEvent(onConnect);
  const handleDisconnect = useEvent(onDisconnect);
  const handleError = useEvent(onError);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      console.warn("WebSocket not connecting: user not authenticated");
      return;
    }

    const mgr = getManager();

    // Register handlers (useEvent safely handles undefined callbacks)
    if (stream) {
      cleanupFns.current.push(
        mgr.addStreamHandler(stream, handleMessage),
      );
    } else {
      cleanupFns.current.push(
        mgr.addMessageHandler(handleMessage),
      );
    }

    cleanupFns.current.push(
      mgr.subscribe("connected", handleConnect),
    );

    cleanupFns.current.push(
      mgr.subscribe("disconnected", handleDisconnect),
    );

    cleanupFns.current.push(
      mgr.subscribe("error", handleError),
    );

    // Always subscribe to update local status
    cleanupFns.current.push(
      mgr.subscribe("connected", () =>
        setConnectionStatus("connected"),
      ),
    );
    cleanupFns.current.push(
      mgr.subscribe("disconnected", () =>
        setConnectionStatus("disconnected"),
      ),
    );
    cleanupFns.current.push(
      mgr.subscribe("error", () =>
        toast.error(
          `Oops! There was an error when communicating with the server. If you are experiencing issues, please try refreshing the page.`,
        ),
      ),
    );
    cleanupFns.current.push(
      mgr.subscribe("connecting", () => {
        setConnectionStatus("connecting");
        setHasAttemptedConnection(true);
      }),
    );
    cleanupFns.current.push(
      mgr.subscribe("disconnecting", () =>
        setConnectionStatus("disconnecting"),
      ),
    );

    // Auto-connect if enabled
    if (autoConnect) {
      mgr.connect();
    }

    // Cleanup function
    return () => {
      cleanupFns.current.forEach((cleanup) => cleanup());
      cleanupFns.current = [];
    };
  }, [getManager, stream, autoConnect, authStatus, handleMessage, handleConnect, handleDisconnect, handleError]);

  const connect = useCallback(() => {
    getManager().connect();
  }, [getManager]);

  const disconnect = useCallback(() => {
    getManager().disconnect();
  }, [getManager]);

  const send = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      getManager().send(data, stream);
    },
    [getManager, stream],
  );

  return {
    connect,
    disconnect,
    send,
    connectionStatus,
    hasAttemptedConnection,
  };
}
