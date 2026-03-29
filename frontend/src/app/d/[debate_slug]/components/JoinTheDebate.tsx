import { DebateFullSchema } from "@/lib/models";
import SetStanceDialog from "./SetStanceDialog";
import DebateNowDialog from "./DebateNowDialog";
import CreateInviteDialog from "./CreateInviteDialog";

interface DebateContentProps {
  debate: DebateFullSchema;
}

export const JoinTheDebate = ({ debate }: DebateContentProps) => {
  return (
    <section className="py-2">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Join the Debate</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Set Your Stance Button */}
        <div>
          <SetStanceDialog
            initialStance={debate.user_stance}
            debateSlug={debate.slug}
          />
        </div>

        {/* Debate Now Button */}
        <div>
          <DebateNowDialog debate={debate} />
        </div>

        {/* Invite to Debate Button */}
        <div>
          <CreateInviteDialog debate={debate} />
        </div>
      </div>
    </section>
  );
};
