"use client";

import { useAuth } from "@/providers/authProvider";
import { CurrentUserResponse } from "@/lib/models";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import { Box } from "@/components/ui/box";

const toTitleCase = (str: string | null | undefined) => {
  if (!str) {
    return str;
  }
  return str
    .toLowerCase() // Convert the entire string to lowercase first
    .split(" ") // Split the string into an array of words
    .map(function (word: string) {
      // For each word, capitalize the first letter and concatenate with the rest of the word
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" "); // Join the words back into a single string with spaces
};

const formatName = (user: CurrentUserResponse) => {
  if (!user.first_name && !user.last_name) return null;
  return (
    toTitleCase(`${user.first_name || ""} ${user.last_name || ""}`.trim()) ||
    null
  );
};

const SettingsUserBanner = () => {
  const { user } = useAuth();

  if (!user?.is_authenticated) return null; // since we hydrate in the main layout, this should never be seen

  return (
    <Box className={"p-4"}>
      <div className="flex items-center space-x-4">
        <UserAvatar user={user} size="xlarge" />
        <div>
          <h2 className="text-xl font-semibold text-white">
            {formatName(user) || (
              <span className="text-gray-400 italic">No name set</span>
            )}
          </h2>
          <p className="text-gray-400">{user.username}</p>
          <div className="flex items-center mt-2">
            <Badge
              variant={
                user.is_superuser
                  ? "destructive"
                  : user.is_staff
                    ? "default"
                    : "secondary"
              }
              className="me-2"
            >
              {user.is_superuser ? "Admin" : user.is_staff ? "Staff" : "Member"}
            </Badge>
            {user.date_joined && (
              <span className="text-sm text-gray-400">
                Member since {new Date(user.date_joined).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Box>
  );
};

export default SettingsUserBanner;
