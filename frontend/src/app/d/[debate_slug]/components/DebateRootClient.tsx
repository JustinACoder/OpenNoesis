"use client";

/*
Note: although this file is use client, it will be rendered on the server first.
This is because the parent page is hydrated with data from the server.
This allows us to use server-side data for initial rendering,
and then client-side interactions (like voting) can be handled without a full page reload.

Tl;dr: this is SSR, dont worry about the "use client" directive.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DebateVote } from "./DebateVote";
import { StanceDistribution } from "./StanceDistribution";
import { JoinTheDebate } from "./JoinTheDebate";
import { DebateComments } from "./DebateComments";
import { RelatedDebates } from "./RelatedDebates";
import {
  useDebateApiGetDebate,
  useDebateApiGetDebateSuggestions,
} from "@/lib/api/debate";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { DebateMarkdown } from "@/components/markdown/DebateMarkdown";
import { useAuthState } from "@/providers/authProvider";
import { SquarePen } from "lucide-react";

interface DebateRootClientProps {
  debateSlug: string;
}

const DebateRootClient = ({ debateSlug }: DebateRootClientProps) => {
  const { authStatus, user } = useAuthState();
  // Retrieve the debate data from the cache
  const { data: debate } = useDebateApiGetDebate(debateSlug);
  const { data: suggestions } = useDebateApiGetDebateSuggestions(
    debateSlug,
    undefined,
    {
      query: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchInterval: false,
        gcTime: 1000 * 60 * 60, // 1 hour
      },
    },
  );

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
  const canEditDebate =
    authStatus === "authenticated" &&
    Boolean(debate.author?.id) &&
    debate.author?.id === user.id;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 xl:gap-10">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            <section className="space-y-6">
              {/* Header with category and actions */}
              <div className="flex flex-row items-center justify-between gap-4">
                <span className="rounded-full bg-foreground/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Debate
                </span>
                <div className="flex items-center gap-3">
                  {canEditDebate ? (
                    <Button asChild variant="outline" className="bg-transparent">
                      <Link href={`/d/${debate.slug}/edit`}>
                        <SquarePen className="size-4" />
                        Edit debate
                      </Link>
                    </Button>
                  ) : null}
                  <DebateVote
                    debateSlug={debate.slug}
                    initialVoteScore={debate.vote_score || 0}
                    initialUserVote={debate.user_vote || 0}
                    size="lg"
                  />
                </div>
              </div>

              {/* Title and date*/}
              <div>
                <h1 className="flex-1 text-2xl font-bold leading-tight text-foreground md:text-3xl">
                  {debate.title}
                </h1>
                <div className="text-sm text-muted-foreground">
                  <time dateTime={debate.date}>{formattedDate}</time>
                  {debate.author?.username ? (
                    <>
                      {" "}
                      · by{" "}
                      <Link
                        href={`/u/${encodeURIComponent(debate.author.username)}`}
                        className="text-foreground/80 underline underline-offset-2 transition-colors hover:text-foreground"
                      >
                        {debate.author.username}
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>

              {debate.image_url ? (
                <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-border/60">
                  <ImageWithFallback
                    key={debate.image_url}
                    src={debate.image_url}
                    alt={debate.title}
                    fill
                    sizes="(max-width: 1023px) 100vw, 66vw"
                    className="object-cover"
                  />
                </div>
              ) : null}

              {/* Description */}
              <div className="space-y-4">
                {debate.description ? (
                  <DebateMarkdown>{debate.description}</DebateMarkdown>
                ) : (
                  <p className="text-sm leading-7 text-muted-foreground md:text-base">
                    No description provided.
                  </p>
                )}
              </div>

              {/* Stance distribution */}
              <StanceDistribution
                numFor={debate.num_for || 0}
                numAgainst={debate.num_against || 0}
              />
            </section>

            {/* Join the Debate Section */}
            <JoinTheDebate debate={debate} />

            {/* Comments Section */}
            <DebateComments debateSlug={debateSlug} />
          </div>

          {/* Sidebar */}
          {suggestions ? (
            <RelatedDebates debates={suggestions.items} />
          ) : (
            <div className="text-muted-foreground">
              A problem occurred while loading related debates.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebateRootClient;
