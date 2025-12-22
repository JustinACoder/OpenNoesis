import { debatemeApiViewInvite } from "@/lib/api/invites";
import { InviteSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";
import Link from "next/link";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import InviteSuccessPage from "@/app/invite/[invite_code]/components/InviteSuccessPage";

interface InvitePageProps {
  params: Promise<{ invite_code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { invite_code } = await params;

  let invite: InviteSchema;
  try {
    invite = await debatemeApiViewInvite(invite_code);
  } catch (error) {
    console.error("Error fetching invite:", error);
    return (
      <NavigationOverlay show_footer={false}>
        <div className="flex items-center justify-center p-4">
          <Box className="max-w-md w-full p-6 text-center">
            <h1 className="text-xl font-semibold text-white mb-2">
              Invalid Invite
            </h1>
            <p className="text-gray-300 mb-4">
              This invite code is invalid or has expired.
            </p>
            <Link
              href="/"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Return to homepage
            </Link>
          </Box>
        </div>
      </NavigationOverlay>
    );
  }

  return (
    <NavigationOverlay show_footer={false}>
      <InviteSuccessPage invite={invite} />
    </NavigationOverlay>
  );
}
