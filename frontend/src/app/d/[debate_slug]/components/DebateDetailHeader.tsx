import { DebateFullSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";
import { DebateVote } from "./DebateVote";

interface DebateDetailHeaderProps {
  debate: DebateFullSchema;
}

export const DebateDetailHeader = ({ debate }: DebateDetailHeaderProps) => {
  const {
    title,
    num_for = 0,
    num_against = 0,
    vote_score = 0,
    user_vote = 0,
    date,
    description,
  } = debate;

  const totalStances = num_for + num_against;
  const forPercent =
    totalStances > 0 ? Math.round((num_for / totalStances) * 100) : 50;
  const againstPercent = totalStances > 0 ? 100 - forPercent : 50;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Box className="p-6 space-y-5" hover={false}>
      {/* Header with category and actions */}
      <div className="flex flex-row justify-between items-start gap-4">
        <span className="bg-amber-500 text-gray-900 text-xs font-bold px-3 py-1 rounded">
          Debate
        </span>
        <DebateVote
          debateSlug={debate.slug}
          initialVoteScore={vote_score}
          initialUserVote={user_vote}
          size="lg"
        />
      </div>

      {/* Title and date*/}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight flex-1">
          {title}
        </h1>
        <time dateTime={date} className="text-sm text-gray-400">
          {formattedDate}
        </time>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm md:text-base leading-relaxed text-pretty whitespace-pre-line">
        {description || "No description provided."}
      </p>

      {/* Stance distribution */}
      <div className="space-y-3">
        <div className="flex justify-between font-semibold text-sm">
          <span className="text-primary">{num_for} participants support</span>
          <span className="text-amber-500">
            {num_against} participants oppose
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="bg-primary transition-all duration-300"
            style={{ width: `${forPercent}%` }}
          />
          <div
            className="bg-amber-500 transition-all duration-300"
            style={{ width: `${againstPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{forPercent}% for</span>
          <span>{againstPercent}% against</span>
        </div>
      </div>
    </Box>
  );
};
