"use client";

import { useDebatemeApiListInvites } from "@/lib/api/invites";
import React, { useState } from "react";
import { InviteCard } from "@/app/my-invites/components/InviteCard";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

      {/* Pagination taken from notifications TODO: make into a reusable component */}
      {!isPending && totalPages > 1 && (
        <div className="flex justify-center pt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(page - 1)}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {/* Page Numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {totalPages > 5 && page < totalPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(page + 1)}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
