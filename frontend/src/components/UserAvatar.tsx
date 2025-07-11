import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React from "react";

interface UserAvatarProps {
  user: {
    username: string;
    avatarUrl?: string;
  };
  size?: "small" | "medium" | "large";
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
  }[size || DEFAULT_SIZE];

  return (
    <Avatar className={sizeClass}>
      <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
      <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
