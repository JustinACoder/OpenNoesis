"use client";

import { CheckCircle, Loader } from "lucide-react";
import styles from "@/styles/pairingBanner.module.css";
import { Button } from "@/components/ui/button";
import { usePairing, PairingBannerStatus } from "@/lib/hooks/pairingHook";
import { usePairingApiCancelPairing } from "@/lib/api/pairing";

const STATUS_CLASSES: Record<PairingBannerStatus, string> = {
  active: `${styles.pairingBanner} ${styles.searching}`,
  match_found: `${styles.pairingBanner} ${styles.matchFound}`,
  server_error: `${styles.pairingBanner} ${styles.serverError}`,
  connection_error: `${styles.pairingBanner} ${styles.connectionError}`,
};

const ActiveSearchBanner = () => {
  // Unified hook replaces prior logic
  const {
    status: connectionStatus,
    elapsedSeconds,
    pairingRequest,
    forceClosePairingBanner,
  } = usePairing();
  const { mutateAsync: cancelPairing } = usePairingApiCancelPairing();

  if (!connectionStatus) return null;

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const cancelPairingHandler = async () => {
    if (
      connectionStatus === "server_error" ||
      connectionStatus === "connection_error"
    ) {
      forceClosePairingBanner();
      return;
    }

    if (connectionStatus === "match_found") {
      return; // Cant cancel if match found
    }

    if (connectionStatus === "active") {
      try {
        await cancelPairing({ pairingRequestId: pairingRequest.id! });
      } catch (error) {
        console.error("Error cancelling pairing:", error);
      }
    }
  };

  const bannerStyle = STATUS_CLASSES[connectionStatus];

  return (
    <div
      className={`h-12 w-full flex items-center justify-between px-4 ${bannerStyle}`}
    >
      {/* Searching content */}
      {connectionStatus === "active" && (
        <div className="flex items-center gap-3 searching-content">
          <Loader className="animate-spin w-4 h-4" />
          <span className="m-0 hidden sm:inline">
            Waiting for a debater on{" "}
            <strong>{pairingRequest.debate.title}</strong>
          </span>
          <span className="m-0 inline sm:hidden">Searching...</span>
          <span className="elapsed-time">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        </div>
      )}

      {/* Match found content */}
      {connectionStatus === "match_found" && (
        <div className="flex items-center gap-3 match-found-content">
          <CheckCircle className="w-6 h-6" />
          <span className="m-0 hidden sm:inline">
            Match found! You will be redirected soon.
          </span>
          <span className="m-0 inline sm:hidden">Match found!</span>
        </div>
      )}

      {/* Error content */}
      {(connectionStatus === "server_error" ||
        connectionStatus === "connection_error") && (
        <div className="flex items-center gap-3 error-content">
          <span className="m-0 hidden sm:inline">
            {connectionStatus === "server_error"
              ? "Server error occurred. Please try again later."
              : "Connection error. Please check your internet connection."}
          </span>
          <span className="m-0 inline sm:hidden">
            {connectionStatus === "server_error"
              ? "Server error."
              : "Connection error."}
          </span>
        </div>
      )}

      {/* Cancel button */}
      {connectionStatus !== "match_found" && (
        <Button variant="outline" size="sm" onClick={cancelPairingHandler}>
          Cancel
        </Button>
      )}
    </div>
  );
};

export default ActiveSearchBanner;
