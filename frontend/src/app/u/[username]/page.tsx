import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, User, Shield } from "lucide-react";
import { Box } from "@/components/ui/box";
import UserAvatar from "@/components/UserAvatar";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { usersApiGetPublicUserProfileByUsername } from "@/lib/api/users";
import ParticipatingDebateList from "@/app/u/[username]/components/ParticipatingDebateList";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { redirect } from "next/navigation";
import { cache } from "react";
import { debateApiGetDebatesWithUserStance } from "@/lib/api/debate";
import { sanitizeTextForMeta } from "@/lib/seo";

interface UserPageProps {
  params: Promise<{
    username: string;
  }>;
}

const getUserProfilePageData = cache(async (username: string) => {
  const user = await usersApiGetPublicUserProfileByUsername(username).catch(() => {
    notFound();
  });

  const debates = await debateApiGetDebatesWithUserStance({
    page: 1,
    user_id: user.id!,
  }).catch(() => ({
    count: 0,
    items: [],
  }));

  return { user, debates };
});

const redirectToUserProfile = async () => {
  const currentUser = await projectOpenDebateApiGetCurrentUserObject();

  if (currentUser.is_authenticated) {
    const encodedUsername = encodeURIComponent(currentUser.username);
    redirect(`/u/${encodedUsername}`);
  } else {
    redirect("/login?next=/u/me");
  }
};

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const { username } = await params;

  if (username === "me") {
    return {
      title: "My Profile",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  try {
    const { user } = await getUserProfilePageData(username);
    const description = user.bio
      ? sanitizeTextForMeta(user.bio)
      : `${user.username}'s profile and recent debate activity on OpenNoesis.`;

    return {
      title: `${user.username}`,
      description,
      alternates: {
        canonical: `/u/${encodeURIComponent(user.username)}`,
      },
      openGraph: {
        type: "profile",
        title: `${user.username} | OpenNoesis`,
        description,
        url: `/u/${encodeURIComponent(user.username)}`,
      },
      twitter: {
        card: "summary",
        title: `${user.username} | OpenNoesis`,
        description,
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  } catch {
    return {
      title: "User Not Found",
      robots: {
        index: false,
        follow: true,
      },
    };
  }
}

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;

  // If the username is "me", redirect to the current user's profile
  if (username === "me") {
    await redirectToUserProfile();
    // No need to return anything here, redirect() internally throws an error that triggers a redirect
  }

  const { user, debates } = await getUserProfilePageData(username);

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
          <ParticipatingDebateList user={user} initialDebates={debates} />
        </section>
      </div>
    </NavigationOverlay>
  );
}
