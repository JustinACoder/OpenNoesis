import { useCallback, useRef } from "react";
import { useWebSocket } from "./websocket";
import { CurrentActivePairingRequest } from "@/lib/models";

interface UsePairingWebSocketOptions {
  autoConnect?: boolean;
  keepAliveAckTimeoutMs?: number;
  onPaired?: (discussionId: number) => void;
  onCancelPairing?: () => void;
  onStartSearch?: (pairingRequest: CurrentActivePairingRequest) => void;
  onMatchFound?: (pairingRequest: CurrentActivePairingRequest) => void;
  onKeepAliveError?: () => void;
  onKeepAliveNoResponse?: () => void;
}

export function usePairingWebSocket({
  autoConnect = true,
  keepAliveAckTimeoutMs = 5000,
  onPaired,
  onCancelPairing,
  onStartSearch,
  onMatchFound,
  onKeepAliveError,
  onKeepAliveNoResponse,
}: UsePairingWebSocketOptions = {}) {
  const hasReceivedKeepAliveAck = useRef(true);

  const { send, connectionStatus, hasAttemptedConnection } = useWebSocket({
    stream: "pairing",
    autoConnect,
    onMessage: (payload) => {
      if (payload.status === "success" && payload.event_type) {
        if (payload.event_type === "cancel") {
          onCancelPairing?.();
        } else if (payload.event_type === "paired") {
          const discussionId = payload.data?.discussion_id as number;
          onPaired?.(discussionId);
        } else if (payload.event_type === "keepalive_ack") {
          hasReceivedKeepAliveAck.current = true;
        } else if (payload.event_type === "start_search") {
          const pairingRequest: CurrentActivePairingRequest = payload.data;
          onStartSearch?.(pairingRequest);
        } else if (payload.event_type === "match_found") {
          const pairingRequest: CurrentActivePairingRequest = payload.data;
          onMatchFound?.(pairingRequest);
        } else {
          console.warn(
            `Unknown pairing websocket event_type: ${payload.event_type}`,
          );
        }
      }

      if (
        payload.status === "error" &&
        payload.event_type === "keepalive_ack"
      ) {
        onKeepAliveError?.();
      }
    },
  });

  const sendKeepAlive = useCallback(() => {
    send({ event_type: "keepalive", data: {} });

    // Setup timeout to check for ack
    hasReceivedKeepAliveAck.current = false;
    setTimeout(() => {
      if (!hasReceivedKeepAliveAck.current) {
        onKeepAliveNoResponse?.();
      }
    }, keepAliveAckTimeoutMs);
  }, [keepAliveAckTimeoutMs, onKeepAliveNoResponse, send]);

  return {
    wsConnectionStatus: connectionStatus,
    hasAttemptedConnection,
    sendKeepAlive,
  };
}
