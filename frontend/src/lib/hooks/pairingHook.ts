import { useEffect, useMemo, useState } from "react";
import { usePairingApiGetCurrentActivePairing } from "@/lib/api/pairing";
import { usePairingWebSocket } from "./ws/pairingWebsocket";
import { useRouter } from "next/navigation";
import {
  CurrentActivePairingRequest,
  CurrentActivePairingRequestStatus,
} from "@/lib/models";
import { toast } from "sonner";

type ErrorStatus = "server_error" | "connection_error";
export type PairingBannerStatus =
  | CurrentActivePairingRequestStatus
  | ErrorStatus;

type UsePairingResult = {
  forceClosePairingBanner: () => void;
  elapsedSeconds: number;
} & (
  | {
      status: CurrentActivePairingRequestStatus;
      pairingRequest: CurrentActivePairingRequest;
    }
  | {
      status: ErrorStatus;
      pairingRequest?: CurrentActivePairingRequest;
    }
  | { status: null; pairingRequest: never }
);

function isStrCoreStatus(
  s: PairingBannerStatus | null | undefined,
): s is CurrentActivePairingRequestStatus {
  if (!s) return false;
  return ["active", "match_found"].includes(s);
}

function isStrErrorStatus(
  s: PairingBannerStatus | null | undefined,
): s is ErrorStatus {
  if (!s) return false;
  return ["server_error", "connection_error"].includes(s);
}

export function usePairing(): UsePairingResult {
  const router = useRouter();
  const [errorStatus, setErrorStatus] = useState<ErrorStatus | null>(null);
  const [pairingRequest, setPairingRequest] = useState<
    CurrentActivePairingRequest | undefined
  >(undefined);

  const { wsConnectionStatus, hasAttemptedConnection, sendKeepAlive } =
    usePairingWebSocket({
      onPaired: (discussionId) => {
        console.log("Paired with discussion ID:", discussionId);
        router.push(`/chat/${discussionId}`);
        setErrorStatus(null);
        setPairingRequest(undefined);
      },
      onCancelPairing: () => {
        setErrorStatus(null);
        setPairingRequest(undefined);
      },
      onKeepAliveError: () => {
        setErrorStatus("server_error");
      },
      onKeepAliveNoResponse: () => {
        setErrorStatus("connection_error");
      },
      onStartSearch: (pairingRequest) => {
        setPairingRequest(pairingRequest);
      },
      onMatchFound: (pairingRequest) => {
        setPairingRequest(pairingRequest);
      },
    });

  const {
    data: apiActive,
    isError: apiError,
    isFetching: apiFetching,
    isPending: apiPending,
  } = usePairingApiGetCurrentActivePairing();

  useEffect(() => {
    if (apiFetching || apiPending) return; // Don't override status while fetching or have not yet started fetching at all

    if (apiError) {
      setErrorStatus("server_error");
      return;
    }

    setErrorStatus(null);

    if (!apiActive) {
      setPairingRequest(undefined);
      return;
    }

    if (isStrCoreStatus(apiActive.status)) {
      setPairingRequest(apiActive);
    } else {
      toast.warning(`Unknown pairing status from API: ${apiActive.status}`);
      setErrorStatus(null);
      setPairingRequest(undefined);
    }
  }, [apiActive, apiError, apiFetching, apiPending]);

  const status: PairingBannerStatus | undefined = useMemo(() => {
    if (errorStatus) return errorStatus;

    const wsDisconnected =
      wsConnectionStatus === "disconnected" ||
      wsConnectionStatus === "disconnecting";

    if (wsDisconnected && hasAttemptedConnection) {
      // We attempted to connect once but are now later disconnected
      return "connection_error";
    }

    if (pairingRequest) return pairingRequest.status;

    return undefined;
  }, [errorStatus, pairingRequest, wsConnectionStatus, hasAttemptedConnection]);

  // Elapsed time
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const createdAt = pairingRequest?.created_at;

    if (!createdAt) return () => {};

    const base = new Date(createdAt).getTime();
    setElapsedSeconds(Math.floor((Date.now() - base) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingRequest?.created_at]);

  // Send keepalive periodically
  useEffect(() => {
    if (!isStrCoreStatus(status)) return;

    sendKeepAlive(); // Send immediately to reset server timer
    const interval = setInterval(() => {
      sendKeepAlive();
    }, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [status, sendKeepAlive]);

  const forceClosePairingBanner = () => {
    setErrorStatus(null);
    setPairingRequest(undefined);
  };

  // Return the right type branch
  // We could simplify this but then the caller would have to do more type narrowing
  if (isStrCoreStatus(status)) {
    // Assert that when status is a core status, pairingRequest is defined
    if (!pairingRequest) {
      throw new Error(
        `Invariant violation: pairingRequest must be defined when status is ${status}`,
      );
    }

    return { status, pairingRequest, elapsedSeconds, forceClosePairingBanner };
  } else if (isStrErrorStatus(status)) {
    return { status, pairingRequest, elapsedSeconds, forceClosePairingBanner };
  } else {
    return {
      status: null,
      pairingRequest: undefined as never,
      elapsedSeconds,
      forceClosePairingBanner,
    };
  }
}
