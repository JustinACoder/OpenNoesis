import Link from "next/link";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { DebateSchema } from "@/lib/models";
import { Box } from "./ui/box";

export const DebateCard = (debate: DebateSchema) => {
  const {
    slug,
    title,
    description_preview,
    num_for = 0,
    num_against = 0,
    vote_score = 0,
    date,
  } = debate;
  const totalStances = num_for + num_against;
  const forPercent =
    totalStances > 0 ? Math.round((num_for / totalStances) * 100) : 50;
  const againstPercent = totalStances > 0 ? 100 - forPercent : 50;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link href={`/d/${slug}`} className="block group">
      <Box className="overflow-hidden flex flex-col h-full">
        <div className="p-5 space-y-4 flex-1">
          {/* Top right vote score */}
          <div className="flex justify-between items-center">
            <span className="bg-amber-500 text-gray-900 text-xs font-bold px-2 py-1 rounded">
              Debate
            </span>
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
