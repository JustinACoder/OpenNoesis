import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React from "react";

interface UserAvatarProps {
  user: {
    username: string;
    avatarUrl?: string;
  };
  size?: "small" | "medium" | "large" | "xlarge" | "xxlarge";
}

const DEFAULT_SIZE = "medium"; // Default size if not specified

const UserAvatar = ({ user, size }: UserAvatarProps) => {
  const getUserInitials = () => {
    return (
      user.username.charAt(0).toUpperCase() +
      user.username.charAt(1).toUpperCase()
    );
  };

  const sizeClass = {
    small: "h-6 w-6",
    medium: "h-8 w-8",
    large: "h-10 w-10",
    xlarge: "h-14 w-14",
    xxlarge: "h-18 w-18",
  }[size || DEFAULT_SIZE];

  const textSizeClass = {
    small: "text-xs font-bold",
    medium: "text-sm font-bold",
    large: "text-base font-bold",
    xlarge: "text-2xl font-bold",
    xxlarge: "text-3xl font-bold",
  }[size || DEFAULT_SIZE];

  return (
    <Avatar className={sizeClass}>
      <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
      <AvatarFallback className={textSizeClass}>
        {getUserInitials()}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
