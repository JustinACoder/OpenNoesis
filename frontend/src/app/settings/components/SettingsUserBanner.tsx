"use client";

import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import { Box } from "@/components/ui/box";
import { AuthRequired } from "@/components/AuthRedirects";
import { useProjectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { Alert } from "@/components/ui/alert";

const SettingsUserBanner = () => {
  const { data: user } = useProjectOpenDebateApiGetCurrentUserObject();

  if (!user) {
    return <Alert variant="destructive">Error loading user information.</Alert>;
  }

  return (
    <AuthRequired>
      <Box className={"p-4"}>
        <div className="flex items-center space-x-4">
          <UserAvatar user={user} size="xlarge" />
          <div>
            <h2 className="text-xl font-semibold text-white">
              {user.username}
            </h2>
            {user.email && <p className="text-gray-400">{user.email}</p>}
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
                {user.is_superuser
                  ? "Admin"
                  : user.is_staff
                    ? "Staff"
                    : "Member"}
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
    </AuthRequired>
  );
};

export default SettingsUserBanner;
