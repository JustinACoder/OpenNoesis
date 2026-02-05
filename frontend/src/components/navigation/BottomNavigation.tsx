import Link from "next/link";
import { Bell, Compass, MessageCircle, Settings } from "lucide-react";
import React from "react";
import UserAvatar from "@/components/UserAvatar";
import UnreadNotifBadgeCount from "@/components/navigation/UnreadNotifBadgeCount";
import UnreadMessagesBadgeCount from "@/components/navigation/UnreadMessagesBadgeCount";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";

const BottomNavigation = async () => {
  const user = await projectOpenDebateApiGetCurrentUserObject();

  return (
    <div className="z-50 border-t w-full">
      <div className="grid grid-cols-5 h-16">
        <Link
          href="/"
          className="flex flex-col items-center justify-center space-y-1 hover:bg-accent transition-colors"
        >
          <Compass className="h-5 w-5" />
          <span className="text-xs">Explore</span>
        </Link>
        <Link
          href="/notifications"
          className="flex flex-col items-center justify-center space-y-1 hover:bg-accent transition-colors relative"
        >
          <Bell className="h-5 w-5" />
          <span className="text-xs">Alerts</span>
          <UnreadNotifBadgeCount />
        </Link>
        <Link
          href="/chat/"
          className="flex flex-col items-center justify-center space-y-1 hover:bg-accent transition-colors relative"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-xs">Messages</span>
          <UnreadMessagesBadgeCount />
        </Link>
        <Link
          href="/settings/"
          className="flex flex-col items-center justify-center space-y-1 hover:bg-accent transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Settings</span>
        </Link>
        <Link
          href={`/u/${encodeURIComponent(user.username)}`}
          className="flex flex-col items-center justify-center space-y-1 hover:bg-accent transition-colors"
        >
          <UserAvatar user={user} size="small" />
          <span className="text-xs">Profile</span>
        </Link>
      </div>
    </div>
  );
};

export default BottomNavigation;
