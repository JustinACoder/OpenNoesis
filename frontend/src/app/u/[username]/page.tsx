import { notFound } from "next/navigation";
import { Calendar, User, Shield } from "lucide-react";
import { Box } from "@/components/ui/box";
import UserAvatar from "@/components/UserAvatar";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { usersApiGetPublicUserProfileByUsername } from "@/lib/api/users";
import ParticipatingDebateList from "@/app/u/[username]/components/ParticipatingDebateList";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { redirect } from "next/navigation";

interface UserPageProps {
  params: Promise<{
    username: string;
  }>;
}

const redirectToUserProfile = async () => {
  const currentUser = await projectOpenDebateApiGetCurrentUserObject();

  if (currentUser.is_authenticated) {
    const encodedUsername = encodeURIComponent(currentUser.username);
    redirect(`/u/${encodedUsername}`);
  } else {
    redirect("/login?next=/u/me");
  }
};

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;

  // If the username is "me", redirect to the current user's profile
  if (username === "me") {
    await redirectToUserProfile();
    // No need to return anything here, redirect() internally throws an error that triggers a redirect
  }

  // Get user data using the new username endpoint
  const user = await usersApiGetPublicUserProfileByUsername(username).catch(
    (error) => {
      console.log(error);
      notFound();
    },
  );

  const joinDate = user.date_joined
    ? new Date(user.date_joined).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* User Profile Header */}
        <Box className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar and Basic Info */}
            <div className="flex items-center gap-4">
              <UserAvatar user={{ username: user.username }} size="large" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-white">
                    {user.username}
                  </h1>
                  {user.is_staff && (
                    <div title="Staff Member">
                      <Shield className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-400 mt-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {joinDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                About
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {user.bio}
              </p>
            </div>
          )}

          {/* No bio placeholder */}
          {!user.bio && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-gray-400 italic">No bio yet.</p>
            </div>
          )}
        </Box>

        {/* Recent Debates Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Recent Debates
            </h2>
            <p className="text-gray-400 text-sm">
              These are the debates on which {user.username} has most recently
              taken a stance.
            </p>
          </div>
          <ParticipatingDebateList user={user} />
        </section>
      </div>
    </NavigationOverlay>
  );
}
