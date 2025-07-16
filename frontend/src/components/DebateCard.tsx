import Link from "next/link";
import { ArrowUp, ArrowDown, Minus, User } from "lucide-react";
import { DebateSchema, type StanceDirectionEnum } from "@/lib/models";
import { Box } from "./ui/box";

interface DebateCardProps extends DebateSchema {
  target_user_stance?: StanceDirectionEnum;
  target_user_name?: string; // Optional name for tooltip
}

export const DebateCard = (props: DebateCardProps) => {
  const {
    slug,
    title,
    description_preview,
    num_for = 0,
    num_against = 0,
    vote_score = 0,
    date,
    user_stance, // Current user's stance
    target_user_stance, // Target user's stance (for profile pages)
    target_user_name,
  } = props;

  const totalStances = num_for + num_against;
  const forPercent =
    totalStances > 0 ? Math.round((num_for / totalStances) * 100) : 50;
  const againstPercent = totalStances > 0 ? 100 - forPercent : 50;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Helper function to get stance text
  const getStanceText = (stance: StanceDirectionEnum) => {
    if (stance === 1) return "for";
    if (stance === -1) return "against";
    return "neutral";
  };

  const hasStanceSet = (stance?: StanceDirectionEnum) => {
    return stance !== undefined && stance !== 0;
  };

  console.log(target_user_stance);

  return (
    <Link href={`/d/${slug}`} className="block group">
      <Box
        className={`overflow-hidden flex flex-col h-full relative ${
          hasStanceSet(user_stance) ? "border-l-4" : ""
        }`}
        style={
          hasStanceSet(user_stance)
            ? {
                borderLeftColor:
                  user_stance === 1 ? "var(--primary)" : "var(--destructive)",
              }
            : {}
        }
        hover={true}
      >
        <div className="p-5 space-y-4 flex-1">
          {/* Top section with badge, target user stance, and vote score */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-gray-900 text-xs font-bold px-2 py-1 rounded">
                Debate
              </span>
              {/* Current user stance indicator (subtle text) */}
              {hasStanceSet(user_stance) && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    user_stance === 1
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  You: {getStanceText(user_stance)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Target user stance indicator */}
              {hasStanceSet(target_user_stance) && (
                <div
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                    target_user_stance === 1
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  }`}
                  title={
                    target_user_name
                      ? `${target_user_name} is ${getStanceText(target_user_stance)}`
                      : `User is ${getStanceText(target_user_stance)}`
                  }
                >
                  <User className="w-3 h-3" />
                  <span>{getStanceText(target_user_stance)}</span>
                </div>
              )}

              {/* Vote score */}
              <div className="flex items-center text-sm text-gray-400 gap-1">
                {vote_score > 0 ? (
                  <ArrowUp className="w-4 h-4" />
                ) : vote_score < 0 ? (
                  <ArrowDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                <span>{vote_score}</span>
              </div>
            </div>
          </div>

          {/* Title & description */}
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors line-clamp-2 text-ellipsis">
              {title}
            </h3>
            <time
              dateTime={date}
              className="block text-xs text-gray-400 mt-1 mb-2"
            >
              {formattedDate}
            </time>
            <p className="text-sm text-gray-300 line-clamp-3 text-ellipsis">
              {description_preview}
            </p>
          </div>
        </div>

        {/* For/Against progress section with percentage labels */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span className="w-1/2 text-center">{forPercent}% for</span>
            <span className="w-1/2 text-center">{againstPercent}% against</span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full">
            <div className="bg-primary" style={{ width: `${forPercent}%` }} />
            <div
              className="bg-destructive"
              style={{ width: `${againstPercent}%` }}
            />
          </div>
        </div>
      </Box>
    </Link>
  );
};
