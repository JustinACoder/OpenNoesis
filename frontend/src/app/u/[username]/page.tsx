import { notFound } from "next/navigation";
import { Calendar, User, Shield } from "lucide-react";
import { Box } from "@/components/ui/box";
import UserAvatar from "@/components/UserAvatar";
import { Footer } from "@/components/Footer";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { usersApiGetPublicUserProfileByUsername } from "@/lib/api/users";
import RecentDebateList from "@/app/u/[username]/components/RecentDebateList";

interface UserPageProps {
  params: {
    username: string;
  };
}

export default async function UserPage({ params }: UserPageProps) {
  const { username } = params;

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

  // Calculate years since joining for statistics
  const yearsSinceJoining = user.date_joined
    ? Math.max(
        (new Date().getTime() - new Date(user.date_joined).getTime()) /
          (1000 * 60 * 60 * 24 * 365),
        0.1,
      )
    : 0;

  return (
    <NavigationOverlay>
      <main className="min-h-[calc(100vh-4rem)]">
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
                <p className="text-gray-500 italic">No bio yet.</p>
              </div>
            )}
          </Box>

          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Box className="p-6 text-center" variant="subtle">
              <div className="text-2xl font-bold text-white">
                {Math.round(yearsSinceJoining * 10) / 10}
              </div>
              <div className="text-gray-400">Years Active</div>
            </Box>
          </div>

          {/* Recent Debates Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-white">
              Recent Debates
            </h2>
            <RecentDebateList userId={user.id!} />
          </section>
        </div>
      </main>
      <Footer />
    </NavigationOverlay>
  );
}
