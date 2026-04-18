"use client";

import { useDebatemeApiListInvites } from "@/lib/api/invites";
import React, { useState } from "react";
import { InviteCard } from "@/app/my-invites/components/InviteCard";
import { AppPagination } from "@/components/AppPagination";
import { AlertCircleIcon, Loader2, RefreshCw, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MyInvitesPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch, isRefetching } =
    useDebatemeApiListInvites({
      page,
    });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="w-full mb-6">
        <AlertCircleIcon />
        <AlertTitle>Error loading invites</AlertTitle>
        <AlertDescription>
          An unexpected error occurred while loading your invites. Please try
          again later.
        </AlertDescription>
      </Alert>
    );
  }

  const pageSize = 15; // Taken from backend
  const totalPages = Math.ceil(data.count / pageSize);

  return (
    <div className="space-y-6">
      {/* Header taken from the notification page */}
      <div className="flex items-center gap-3">
        <Send className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Invites</h1>
        <Badge variant="secondary" className="text-sm">
          {data.count}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await refetch();
          }}
          disabled={isRefetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
          />
          <span className="hidden md:inline">
            {isRefetching ? "Refreshing..." : "Refresh"}
          </span>
        </Button>
      </div>

      {/* Invite Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((invite) => (
          <InviteCard key={invite.id} invite={invite} onDelete={refetch} />
        ))}
      </div>

      {!isPending && totalPages > 1 && (
        <AppPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="flex justify-center pt-8"
        />
      )}
    </div>
  );
}
