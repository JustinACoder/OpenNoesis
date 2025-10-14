import { useEffect, useMemo, useState } from "react";
import { usePairingApiGetCurrentActivePairing } from "@/lib/api/pairing";
import { usePairingWebSocket, PairingWSStatus } from "./ws/pairingWebsocket";

type CoreStatus = "idle" | "active" | "match_found";
export type PairingBannerStatus =
  | CoreStatus
  | "server_error"
  | "connection_error";

interface UseUnifiedPairingResult {
  status: PairingBannerStatus | null;
  elapsedSeconds: number;
  debateTitle: string | undefined;
  cancelPairing: () => void;
}

const wsToCore: Record<PairingWSStatus, CoreStatus | null> = {
  none: null,
  idle: "idle",
  active: "active",
  match_found: "match_found",
  paired: "match_found", // treat paired like match_found until redirect
};

interface UsePairingStatusProps {
  devDefaultStatus?: PairingBannerStatus;
}

export function usePairingStatus(
  pairingStatusProps?: UsePairingStatusProps,
): UseUnifiedPairingResult {
  const devDefaultStatus = pairingStatusProps?.devDefaultStatus || null;

  const {
    pairingStatus,
    createdAt: wsCreatedAt,
    wsConnectionStatus,
    cancelPairing,
    hasAttemptedConnection,
  } = usePairingWebSocket();

  const {
    data: apiActive,
    isError: apiError,
    isFetching: apiFetching,
  } = usePairingApiGetCurrentActivePairing();

  const coreStatus: CoreStatus | null = useMemo(() => {
    const wsMapped = wsToCore[pairingStatus];
    if (wsMapped) return wsMapped;
    if (
      apiActive?.status &&
      ["idle", "active", "match_found"].includes(apiActive.status)
    ) {
      return apiActive.status as CoreStatus;
    }
    return null;
  }, [pairingStatus, apiActive?.status]);

  const status: PairingBannerStatus | null = useMemo(() => {
    if (coreStatus) return coreStatus;
    if (apiError) return "server_error";

    const wsDisconnected =
      wsConnectionStatus === "disconnected" ||
      wsConnectionStatus === "disconnecting";

    if (
      wsDisconnected &&
      hasAttemptedConnection &&
      !apiFetching &&
      !apiActive
    ) {
      return "connection_error";
    }

    return devDefaultStatus;
  }, [
    coreStatus,
    apiError,
    wsConnectionStatus,
    hasAttemptedConnection,
    apiFetching,
    apiActive,
    devDefaultStatus,
  ]);

  // 3. Elapsed time (prefer WS createdAt when available)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const createdAt = wsCreatedAt || apiActive?.created_at || null;

    if (!createdAt || !coreStatus) {
      setElapsedSeconds(0);
      return;
    }

    const base = new Date(createdAt).getTime();
    setElapsedSeconds(Math.floor((Date.now() - base) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [wsCreatedAt, apiActive?.created_at, coreStatus]);

  // 4. Debate title (from API; WS does not send it)
  const debateTitle = apiActive?.debate?.title;

  return {
    status,
    elapsedSeconds,
    debateTitle,
    cancelPairing,
  };
}
