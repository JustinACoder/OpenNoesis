import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./websocket";

export type PairingWSStatus =
  | "none" // no active request client-side
  | "idle" // request created, not actively searching yet
  | "active" // actively searching
  | "match_found" // match found, waiting for pairing completion
  | "paired"; // discussion created

interface RequestPairingPayload {
  debate_id: number;
  desired_stance: 1 | -1;
}

interface UsePairingWebSocketOptions {
  autoConnect?: boolean;
  // Optional: start keepalive pings (default true)
  enableKeepAlive?: boolean;
  keepAliveIntervalMs?: number;
  onPaired?: (discussionId: number) => void;
}

interface PairingEventBase {
  event_type: string;
  status: "success" | "error";
  data?: any;
  message?: string;
}

const STATUS_EVENT_TO_STATE: Record<string, PairingWSStatus | undefined> = {
  request_pairing: "idle",
  start_search: "active",
  match_found: "match_found",
  paired: "paired",
  // cancel will revert to none (hidden) or idle if needed; we pick none
};

export function usePairingWebSocket({
  autoConnect = true,
  enableKeepAlive = true,
  keepAliveIntervalMs = 15000,
  onPaired,
}: UsePairingWebSocketOptions = {}) {
  const [pairingStatus, setPairingStatus] = useState<PairingWSStatus>("none");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<PairingEventBase | null>(null);

  // Keepalive timer
  const keepAliveTimer = useRef<NodeJS.Timeout | null>(null);

  const { send, connectionStatus, hasAttemptedConnection } = useWebSocket({
    stream: "pairing",
    autoConnect,
    onMessage: (payload: any) => {
      // Payload already demultiplexed (payload = {status, event_type, ...})
      const evt: PairingEventBase = payload;
      setLastEvent(evt);

      if (evt.status === "success" && evt.event_type) {
        if (evt.event_type === "cancel") {
          // If current user cancelled (data.from_current_user true) -> reset state
          if (evt.data?.from_current_user) {
            setPairingStatus("none");
            setCreatedAt(null);
          }
          // If other user cancelled during a partial flow we also reset
          else {
            setPairingStatus("none");
            setCreatedAt(null);
          }
        } else if (evt.event_type === "keepalive_ack") {
          // No status change
        } else {
          const mapped = STATUS_EVENT_TO_STATE[evt.event_type];
          if (mapped) {
            setPairingStatus(mapped);
            if (mapped === "idle" && !createdAt) {
              // timestamp when request created (backend does not send created_at)
              setCreatedAt(new Date().toISOString());
            }
            if (mapped === "paired") {
              const discussionId = evt.data?.discussion_id;
              if (discussionId && onPaired) {
                onPaired(discussionId);
              }
            }
          }
        }
      }

      if (evt.status === "error" && evt.event_type === "keepalive_ack") {
        // keepalive failed (no active request) -> reset state
        setPairingStatus("none");
        setCreatedAt(null);
      }
    },
  });

  // Actions
  const requestPairing = useCallback(
    (payload: RequestPairingPayload) => {
      send({
        event_type: "request_pairing",
        data: payload,
      });
    },
    [send],
  );

  const startSearch = useCallback(() => {
    if (pairingStatus === "idle" || pairingStatus === "active") {
      send({ event_type: "start_search", data: {} });
    }
  }, [send, pairingStatus]);

  const cancelPairing = useCallback(() => {
    if (pairingStatus !== "none" && pairingStatus !== "paired") {
      send({ event_type: "cancel", data: {} });
    }
  }, [send, pairingStatus]);

  const sendKeepAlive = useCallback(() => {
    if (
      pairingStatus === "idle" ||
      pairingStatus === "active" ||
      pairingStatus === "match_found"
    ) {
      send({ event_type: "keepalive", data: {} });
    }
  }, [send, pairingStatus]);

  // Auto keepalive
  useEffect(() => {
    if (!enableKeepAlive) return;
    if (
      pairingStatus === "idle" ||
      pairingStatus === "active" ||
      pairingStatus === "match_found"
    ) {
      // Immediately send one to refresh server timer
      sendKeepAlive();
      keepAliveTimer.current = setInterval(sendKeepAlive, keepAliveIntervalMs);
    } else {
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current);
      keepAliveTimer.current = null;
    }
    return () => {
      if (keepAliveTimer.current) clearInterval(keepAliveTimer.current);
    };
  }, [pairingStatus, enableKeepAlive, keepAliveIntervalMs, sendKeepAlive]);

  return {
    pairingStatus,
    createdAt,
    lastEvent,
    wsConnectionStatus: connectionStatus,
    hasAttemptedConnection,
    requestPairing,
    startSearch,
    cancelPairing,
    sendKeepAlive,
  };
}
