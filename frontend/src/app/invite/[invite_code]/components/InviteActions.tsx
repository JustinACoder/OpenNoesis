"use client";

import { InviteSchema } from "@/lib/models";
import { useDebatemeApiAcceptInvite } from "@/lib/api/invites";
import { useAuth } from "@/providers/authProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface InviteActionsProps {
  invite: InviteSchema;
}

const InviteActions = ({ invite }: InviteActionsProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const {
    mutateAsync: acceptInvite,
    isPending,
    isSuccess,
  } = useDebatemeApiAcceptInvite();

  const handleActionClick = async () => {
    if (isPending || isSuccess) return; // Prevent multiple submissions

    if (!user?.is_authenticated) {
      router.push(`/login?next=/invite/${invite.code}`);
      return;
    }

    try {
      const inviteUse = await acceptInvite({ inviteCode: invite.code! });
      router.push(`/chat/${inviteUse.resulting_discussion}/`);
    } catch (error) {
      console.error("Error accepting invite:", error);
      toast.error("Failed to accept invite. Please try again.");
    }
  };

  if (user?.is_authenticated && user.id === invite.creator.id) {
    return (
      <Button variant="secondary" disabled={true} className="h-16">
        You can&#39;t accept your own invite
      </Button>
    );
  }

  const variant = !user?.is_authenticated
    ? "secondary"
    : isPending
      ? "outline"
      : "default";

  return (
    <Button
      variant={variant}
      disabled={isPending || isSuccess}
      onClick={handleActionClick}
      className="h-16"
    >
      {user?.is_authenticated
        ? isPending
          ? "Accepting..."
          : isSuccess
            ? "Invite Accepted"
            : "Accept Invite"
        : "Log in to Accept"}
    </Button>
  );
};

export default InviteActions;
