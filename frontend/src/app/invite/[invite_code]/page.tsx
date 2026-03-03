import type { Metadata } from "next";
import { debatemeApiViewInvite } from "@/lib/api/invites";
import { InviteSchema } from "@/lib/models";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import InviteSuccessPage from "@/app/invite/[invite_code]/components/InviteSuccessPage";
import { notFound } from "next/navigation";
import { isApiNotFoundError } from "@/lib/apiError";

interface InvitePageProps {
  params: Promise<{ invite_code: string }>;
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { invite_code } = await params;

  let invite: InviteSchema;
  try {
    invite = await debatemeApiViewInvite(invite_code);
  } catch (error) {
    if (isApiNotFoundError(error)) {
      notFound();
    }
    throw error;
  }

  return (
    <NavigationOverlay show_footer={false}>
      <InviteSuccessPage invite={invite} />
    </NavigationOverlay>
  );
}
