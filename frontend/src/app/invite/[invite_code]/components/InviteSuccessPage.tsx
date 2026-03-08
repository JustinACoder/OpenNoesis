import { Box } from "@/components/ui/box";
import { Calendar, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import Link from "next/link";
import { InviteSchema } from "@/lib/models";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { Button } from "@/components/ui/button";
import InviteActions from "./InviteActions";

interface InviteSuccessPageProps {
  invite: InviteSchema;
}

const InviteSuccessPage = async ({ invite }: InviteSuccessPageProps) => {
  const formattedDate = new Date(invite.created_at).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const user = await projectOpenDebateApiGetCurrentUserObject();

  return (
    <div className="bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        {/* Platform intro for new users - subtle but informative */}
        {!user.is_authenticated && (
          <Box variant="info" className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-cyan-100 mb-1">
                  You&apos;ve been invited to join a debate on{" "}
                  <span className="font-semibold">ProjectOpenDebate</span>
                </p>
                <p className="text-cyan-200/80 text-xs">
                  A platform where people can engage in 1-on-1 debates on topics
                  that they care about. Create an account or sign in to join the
                  debate!
                </p>
              </div>
            </div>
          </Box>
        )}

        {/* Main invite content */}
        <Box className="p-6">
          <div className="space-y-6">
            {/* Header with badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-amber-500 text-gray-900 font-bold">
                Debate Invite
              </Badge>
              <Badge variant="outline" className="text-gray-300">
                Code: {invite.code}
              </Badge>
            </div>

            {/* Debate preview */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-white leading-tight">
                {invite.debate.title}
              </h1>

              {/* Debate author if available */}
              {invite.debate.author && (
                <p className="text-sm text-gray-400">
                  Debate by{" "}
                  <span className="text-gray-300 font-medium">
                    @{invite.debate.author.username}
                  </span>
                </p>
              )}
            </div>

            {/* Invite creator info */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Invited by
              </h3>
              <div className="flex items-center gap-3">
                <UserAvatar
                  user={{ username: invite.creator.username }}
                  size="small"
                />
                <div className="flex-1">
                  <p className="font-medium text-white">
                    @{invite.creator.username}{" "}
                    {invite.creator.id === user.id && "(You)"}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>Invited on {formattedDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Call to action */}
            <div className="border-t border-gray-700 pt-6">
              <div className="text-center space-y-4">
                <p className="text-gray-300 text-sm">
                  Ready to start debating with @{invite.creator.username}?
                </p>
                <div className="flex justify-center gap-4 sm:flex-row flex-col">
                  <div>
                    <InviteActions invite={invite} />
                  </div>
                  <div>
                    <Button variant={"outline"} className="h-16" asChild>
                      <Link
                        href={`/d/${invite.debate.slug}`}
                        target="_blank"
                        className="flex items-center gap-2"
                      >
                        View Debate
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                {user.is_authenticated ? (
                  <p className="text-xs text-gray-500">
                    You are signed in as @{user.username}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    You are not signed in. Create an account or sign in to join
                    the debate.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
};

export default InviteSuccessPage;
