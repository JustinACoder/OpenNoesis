"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bell,
  MessageCircle,
  UserCheck,
  MoreVertical,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { NotificationSchema } from "@/lib/models";
import { useNotificationsApiSetNotificationReadStatus } from "@/lib/api/notifications";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useLongPress } from "@/lib/hooks/mobileInteractionsHooks";

interface NotificationCardProps {
  notification: NotificationSchema;
  onRead: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "new_discussion":
      return MessageCircle;
    case "accepted_invite":
      return UserCheck;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case "new_discussion":
      return "text-blue-500";
    case "accepted_invite":
      return "text-green-500";
    default:
      return "text-gray-400";
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};

// Helper function to get the URL based on notification type and info_args
const getNotificationUrl = (
  notification: NotificationSchema,
): string | null => {
  const { notification_type_name, info_args } = notification;

  switch (notification_type_name) {
    case "new_discussion":
    case "accepted_invite":
      if (info_args?.discussion_id) {
        return `/chat/${info_args.discussion_id}`;
      }
      break;
    default:
      return null;
  }

  return null;
};

export const NotificationCard = ({
  notification,
  onRead,
}: NotificationCardProps) => {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const Icon = getNotificationIcon(notification.notification_type_name);
  const iconColor = getNotificationColor(notification.notification_type_name);

  const markAsReadMutation = useNotificationsApiSetNotificationReadStatus();

  // Detect mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  const handleMarkAsRead = async () => {
    if (notification.read || markAsReadMutation.isPending) return;

    setIsSheetOpen(false); // Close sheet after action

    try {
      await markAsReadMutation.mutateAsync({
        notificationId: notification.id!,
        data: { read_status: true },
      });
      onRead();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleClick = async () => {
    const url = getNotificationUrl(notification);

    if (url) {
      // Mark as read if unread
      if (!notification.read) {
        try {
          await markAsReadMutation.mutateAsync({
            notificationId: notification.id!,
            data: { read_status: true },
          });
          onRead();
        } catch (error) {
          console.error("Failed to mark notification as read:", error);
        }
      }

      // Navigate to the URL
      router.push(url);
    }
  };

  const handleOpenInNewTab = () => {
    setIsSheetOpen(false); // Close sheet after action

    const url = getNotificationUrl(notification);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const longPressEventHandlers = useLongPress(() => {
    setIsSheetOpen(true);
  });

  const timeAgo = formatTimeAgo(notification.created_at);
  const hasUrl = !!getNotificationUrl(notification);

  // Menu items for both dropdown and sheet
  const menuItems = [
    ...(!notification.read
      ? [
          {
            key: "mark-read",
            icon: Check,
            label: "Mark as read",
            onClick: handleMarkAsRead,
            disabled: markAsReadMutation.isPending,
          },
        ]
      : []),
    ...(hasUrl
      ? [
          {
            key: "open-new-tab",
            icon: MessageCircle,
            label: "Open in new tab",
            onClick: handleOpenInNewTab,
            disabled: false,
          },
        ]
      : []),
  ];

  const MoreOptionsMenu = () => {
    if (isMobile) {
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onTouchCancel={(e) => e.stopPropagation()}
        >
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="default"
                className="h-8 w-8 p-0 hover:bg-accent"
              >
                <MoreVertical className="size-5" />
                <span className="sr-only">More options</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>Notification Options</SheetTitle>
                <VisuallyHidden asChild>
                  <SheetDescription className="sr-only">
                    Select an action for this notification
                  </SheetDescription>
                </VisuallyHidden>
              </SheetHeader>
              <div className="grid gap-2">
                {menuItems.map((item) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className="justify-start h-12"
                    onClick={item.onClick}
                    disabled={item.disabled}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Button>
                ))}
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      );
    }

    // Desktop dropdown
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="default"
              className="h-8 w-8 p-0 hover:bg-accent"
            >
              <MoreVertical className="size-5" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {menuItems.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={item.onClick}
                disabled={item.disabled}
                className="cursor-pointer"
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div
      className={`p-4 transition-all duration-200 border-l-4 rounded-lg border bg-card ${
        hasUrl ? "cursor-pointer" : ""
      } ${
        !notification.read
          ? "border-l-blue-500 bg-blue-100/60 hover:bg-blue-50/30 dark:bg-blue-900/40 dark:hover:bg-blue-950/20"
          : "border-l-gray-200 hover:bg-gray-50/80 dark:border-l-gray-700 dark:hover:bg-gray-800/50"
      }`}
      onClick={hasUrl ? handleClick : undefined}
      {...longPressEventHandlers}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${iconColor} mt-0.5`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3
                className={`font-medium text-sm leading-relaxed ${
                  !notification.read
                    ? "font-semibold text-gray-900 dark:text-gray-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {notification.title}
              </h3>
              <p
                className={`text-sm mt-1 leading-relaxed ${
                  !notification.read
                    ? "text-gray-600 dark:text-gray-400"
                    : "text-muted-foreground"
                }`}
              >
                {notification.message}
              </p>
              {notification.endnote && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {notification.endnote}
                </p>
              )}
            </div>

            <div className="flex-shrink-0">
              <MoreOptionsMenu />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>

            {!notification.read && (
              <Badge
                variant="default"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                New
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
