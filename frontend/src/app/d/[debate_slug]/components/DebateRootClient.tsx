"use client";

/*
Note: although this file is use client, it will be rendered on the server first.
This is because the parent page is hydrated with data from the server.
This allows us to use server-side data for initial rendering,
and then client-side interactions (like voting) can be handled without a full page reload.

Tl;dr: this is SSR, dont worry about the "use client" directive.
 */

import { Box } from "@/components/ui/box";
import { DebateVote } from "./DebateVote";
import { StanceDistribution } from "./StanceDistribution";
import { JoinTheDebate } from "./JoinTheDebate";
import { DebateComments } from "./DebateComments";
import { RelatedDebates } from "./RelatedDebates";
import {
  useDebateApiGetDebate,
  useDebateApiGetDebateComments,
  useDebateApiGetDebateSuggestions,
} from "@/lib/api/debate";

interface DebateRootClientProps {
  debateSlug: string;
}

const DebateRootClient = ({ debateSlug }: DebateRootClientProps) => {
  // Retrieve the debate data from the cache
  const { data: debate } = useDebateApiGetDebate(debateSlug);
  const { data: comments } = useDebateApiGetDebateComments(debateSlug);
  const { data: suggestions } = useDebateApiGetDebateSuggestions(debateSlug);

  if (!debate) {
    // Since we are hydrating with server data, this should only happen if the data is not available for some reason
    // Therefore, we show treat this as an error state
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-gray-400 text-lg">
          A problem occurred while loading the debate data.
        </div>
      </div>
    );
  }

  const formattedDate = new Date(debate.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Box className="p-6 space-y-5">
              {/* Header with category and actions */}
              <div className="flex flex-row justify-between items-start gap-4">
                <span className="bg-amber-500 text-gray-900 text-xs font-bold px-3 py-1 rounded">
                  Debate
                </span>
                <DebateVote
                  debateSlug={debate.slug}
                  initialVoteScore={debate.vote_score || 0}
                  initialUserVote={debate.user_vote || 0}
                  size="lg"
                />
              </div>

              {/* Title and date*/}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight flex-1">
                  {debate.title}
                </h1>
                <time dateTime={debate.date} className="text-sm text-gray-400">
                  {formattedDate}
                </time>
              </div>

              {/* Description */}
              <p className="text-gray-300 text-sm md:text-base leading-relaxed text-pretty whitespace-pre-line">
                {debate.description || "No description provided."}
              </p>

              {/* Stance distribution */}
              <StanceDistribution
                numFor={debate.num_for || 0}
                numAgainst={debate.num_against || 0}
              />
            </Box>

            {/* Join the Debate Section */}
            <JoinTheDebate debate={debate} />

            {/* Comments Section */}
            {comments ? (
              <DebateComments
                comments={comments.items}
                debateSlug={debateSlug} // Pass slug for comment submission
              />
            ) : (
              <div className="text-gray-400">
                A problem occurred while loading the comments.
              </div>
            )}
          </div>

          {/* Sidebar */}
          {suggestions ? (
            <RelatedDebates debates={suggestions.items} />
          ) : (
            <div className="text-gray-400">
              A problem occurred while loading related debates.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebateRootClient;
