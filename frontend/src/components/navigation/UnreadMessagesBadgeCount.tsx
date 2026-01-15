"use client";

import BadgeCount from "@/components/navigation/BadgeCount";
import { useDiscussionApiGetMessagesUnreadCount } from "@/lib/api/discussions";

interface UnreadMessagesBadgeCountProps {
  simpleSecondary?: boolean;
}

const UnreadMessagesBadgeCount = ({
  simpleSecondary = false,
}: UnreadMessagesBadgeCountProps) => {
  const unreadCountMutation = useDiscussionApiGetMessagesUnreadCount({
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

export default UnreadMessagesBadgeCount;
