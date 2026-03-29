"use client";

import { useState } from "react";
import {
  useNotificationsApiGetNotifications,
  useNotificationsApiGetNotificationsUnreadCount,
  useNotificationsApiMarkAllNotificationsAsRead,
} from "@/lib/api/notifications";
import { NotificationCard } from "./NotificationCard";
import { NotificationFilter } from "./NotificationFilter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2, RefreshCw, CheckCheck } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function NotificationsClient() {
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [page, setPage] = useState(1);

  const {
    data: notifications,
    isPending,
    isFetching,
    isRefetching,
    error,
    refetch,
  } = useNotificationsApiGetNotifications({
    page,
    only_unread: filter === "unread",
  });

  const { data: unreadCount, refetch: refetchUnreadCount } =
    useNotificationsApiGetNotificationsUnreadCount();

  const markAllAsReadMutation = useNotificationsApiMarkAllNotificationsAsRead();

  const handleRefresh = () => {
    void refetch();
    void refetchUnreadCount();
  };

  const handleNotificationRead = () => {
    void refetch();
    void refetchUnreadCount();
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      handleRefresh();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleFilterChange = (newFilter: "all" | "unread") => {
    setFilter(newFilter);
    setPage(1); // Reset to first page when filter changes

    // scroll to top
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Pagination helpers
  const ITEMS_PER_PAGE = 10; // Should match backend
  const totalPages = notifications
    ? Math.ceil(notifications.count / ITEMS_PER_PAGE)
    : 0;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }

    // scroll to top
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (error || (notifications === undefined && !isPending)) {
    return (
      <main>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">
              Error Loading Notifications
            </h1>
            <p className="text-muted-foreground mb-4">
              Something went wrong while loading your notifications.
            </p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </div>
        </div>
      </main>
    );
  }

  const notificationHeader = (
    <div className="flex items-center justify-between flex-wrap mb-6 gap-4">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Badge variant="secondary" className="text-sm">
          {notifications?.count !== undefined ? notifications.count : "..."}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
          />
          <span className="hidden md:inline">
            {isRefetching ? "Refreshing..." : "Refresh"}
          </span>
        </Button>

        {unreadCount !== undefined && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden md:inline">Mark all read</span>
          </Button>
        )}
      </div>

      <NotificationFilter
        currentFilter={filter}
        onFilterChange={handleFilterChange}
        unreadCount={unreadCount}
      />
    </div>
  );

  return (
    <main>
      <div className="container mx-auto max-w-screen-lg px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        {notificationHeader}

        {/* Loading State */}
        {isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isPending &&
          (!notifications?.items || notifications.items.length === 0) && (
            <div className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-medium mb-2">No notifications</h2>
              <p className="text-muted-foreground">
                {filter === "unread"
                  ? "You have no unread notifications."
                  : "You don't have any notifications yet."}
              </p>
            </div>
          )}

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications?.items.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onRead={handleNotificationRead}
            />
          ))}

          {/* Pagination */}
          {!isPending && totalPages > 1 && (
            <div className="flex justify-center pt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(page - 1)}
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
                          onClick={() => handlePageChange(pageNum)}
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
                      onClick={() => handlePageChange(page + 1)}
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

          {/* Page info */}
          {!isPending && totalPages > 1 && (
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • Showing{" "}
                {notifications.items.length} of {notifications.count}{" "}
                notifications
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
