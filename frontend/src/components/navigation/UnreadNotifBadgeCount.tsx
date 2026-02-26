"use client";

import { useNotificationsApiGetNotificationsUnreadCount } from "@/lib/api/notifications";
import BadgeCount from "@/components/navigation/BadgeCount";

interface UnreadNotifBadgeCountProps {
  simpleSecondary?: boolean;
}

const UnreadNotifBadgeCount = ({
  simpleSecondary = false,
}: UnreadNotifBadgeCountProps) => {
  const unreadCountMutation = useNotificationsApiGetNotificationsUnreadCount({
    query: {
      staleTime: 2 * 60 * 1000, // 2 minutes
    },
  });
  const unreadCount = unreadCountMutation.data || 0;

  if (unreadCount === 0) {
    return null; // No unread notifications, don't render the badge
  } else {
    return <BadgeCount count={unreadCount} simpleSecondary={simpleSecondary} />;
  }
};

export default UnreadNotifBadgeCount;
