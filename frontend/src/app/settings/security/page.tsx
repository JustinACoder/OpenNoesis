"use client";

import { useGetAllauthClientV1AuthSessions } from "@/lib/api/sessions";
import { useDeleteAllauthClientV1AuthSessions } from "@/lib/api/sessions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Timestamp } from "@/lib/models";
import { Separator } from "@/components/ui/separator";

export default function SecuritySettingsPage() {
  const {
    data: sessionsResponse,
    isLoading,
    isError: isErrorRetrieving,
    refetch,
  } = useGetAllauthClientV1AuthSessions("browser");

  const {
    mutateAsync: deleteSessionsByIDs,
    isPending,
    isError: isErrorDeleting,
  } = useDeleteAllauthClientV1AuthSessions();

  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);

  const sessions = sessionsResponse?.data || [];
  const selectableSessions = sessions.filter((session) => !session.is_current);

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getBrowserName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) return "Chrome";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("safari")) return "Safari";
    if (ua.includes("edge")) return "Edge";
    return "Unknown Browser";
  };

  const getDeviceType = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      return "Mobile";
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return "Tablet";
    }
    return "Desktop";
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString();
  };

  const handleEndSession = async (sessionId: number) => {
    await executeEndSessions([sessionId]);
  };

  const handleBulkEndSessions = async () => {
    await executeEndSessions(selectedSessions);
  };

  const executeEndSessions = async (sessionIds: number[]) => {
    try {
      await deleteSessionsByIDs({
        client: "browser",
        data: { sessions: sessionIds },
      });
      await refetch();
      setSelectedSessions([]);
    } catch (error) {
      console.error("Error ending sessions:", error);
    }
  };

  const handleSessionSelection = (sessionId: number, checked: boolean) => {
    if (checked) {
      setSelectedSessions((prev) => [...prev, sessionId]);
    } else {
      setSelectedSessions((prev) => prev.filter((id) => id !== sessionId));
    }
  };

  const selectAllSessions = () => {
    if (selectedSessions.length === selectableSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(selectableSessions.map((s) => s.id));
    }
  };

  return (
    <div className="my-4">
      <h1 className="text-2xl font-bold mb-2">Security Settings</h1>
      <p className="text-muted-foreground mb-4">
        Manage your active sessions and security settings.
      </p>

      {isErrorRetrieving && (
        <Alert variant="destructive" className="w-full mb-4">
          <AlertCircleIcon />
          <AlertTitle>Error loading sessions</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while trying to load your active
            sessions. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {isErrorDeleting && (
        <Alert variant="destructive" className="w-full mb-4">
          <AlertCircleIcon />
          <AlertTitle>Error ending sessions</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while trying to end the selected
            sessions. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" />
            Active Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            These are all the devices and browsers where you&#39;re currently
            signed in. You can end sessions you don&#39;t recognize or no longer
            use. Your current session cannot be ended from here.
          </p>
        </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No active sessions found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk actions */}
              {selectableSessions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        selectedSessions.length === selectableSessions.length
                      }
                      onCheckedChange={selectAllSessions}
                    />
                      <span className="text-sm text-muted-foreground">
                        {selectedSessions.length === 0
                          ? "Select sessions to manage"
                          : `${selectedSessions.length} session${selectedSessions.length === 1 ? "" : "s"} selected`}
                      </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div />
                    {selectedSessions.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkEndSessions}
                        disabled={isPending}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        End Selected Sessions
                      </Button>
                    )}
                  </div>
                  <Separator />
                </div>
              )}

              {/* Sessions list */}
              {sessions.map((session, index) => (
                <React.Fragment key={session.id}>
                  <div
                    className={`flex items-center gap-4 rounded-2xl px-3 py-4 ${
                      session.is_current ? "bg-emerald-500/8" : ""
                    }`}
                  >
                    {!session.is_current ? (
                      <Checkbox
                        checked={selectedSessions.includes(session.id)}
                        onCheckedChange={(checked) =>
                          handleSessionSelection(session.id, checked as boolean)
                        }
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.user_agent)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {getBrowserName(session.user_agent)} on{" "}
                              {getDeviceType(session.user_agent)}
                            </span>
                            {session.is_current && (
                              <Badge variant="secondary" className="text-xs">
                                Current Session
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            IP Address: {session.ip}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <div>Created: {formatDate(session.created_at)}</div>
                        {session.last_seen_at && (
                          <div>Last seen: {formatDate(session.last_seen_at)}</div>
                        )}
                      </div>
                    </div>

                    {!session.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEndSession(session.id)}
                        disabled={isPending}
                        className="gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        End Session
                      </Button>
                    )}
                  </div>
                  {index < sessions.length - 1 ? <Separator /> : null}
                </React.Fragment>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}
