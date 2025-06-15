import { DebateFullSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";
import SetStanceDialog from "./SetStanceDialog";
import DebateNowDialog from "./DebateNowDialog";
import CreateInviteDialog from "./CreateInviteDialog";

interface DebateContentProps {
  debate: DebateFullSchema;
}

export const JoinTheDebate = ({ debate }: DebateContentProps) => {
  return (
    <Box className="p-6" hover={false}>
      <h2 className="text-xl font-semibold text-white mb-4">Join the Debate</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Set Your Stance Button */}
        <div className="flex-1">
          <SetStanceDialog
            initialStance={debate.user_stance}
            debateSlug={debate.slug}
          />
        </div>

        {/* Debate Now Button */}
        <div className="flex-1">
          <DebateNowDialog />
        </div>

        {/* Invite to Debate Button */}
        <div className="flex-1">
          <CreateInviteDialog />
        </div>
      </div>
    </Box>
  );
};
