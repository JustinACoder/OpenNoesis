import { MessageCircle, Loader2, RefreshCw } from "lucide-react";
import {
  CommentSchema,
  type PagedCommentSchema,
  VoteDirectionEnum,
} from "@/lib/models";
import { Box } from "@/components/ui/box";
import { CommentForm } from "./CommentForm";
import { VoteIndicator } from "@/components/ui/VoteIndicator";
import { useAuthState } from "@/providers/authProvider";
import { useRouter } from "next/navigation";
import {
  debateApiGetDebateComments,
  getDebateApiGetDebateCommentsQueryKey,
  useDebateApiVoteOnComment,
} from "@/lib/api/debate";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInfiniteQuery } from "@tanstack/react-query";

interface DebateCommentsProps {
  debateSlug: string;
}

export const DebateComments = ({ debateSlug }: DebateCommentsProps) => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useInfiniteQuery<PagedCommentSchema, Error>({
    queryKey: getDebateApiGetDebateCommentsQueryKey(debateSlug),
    queryFn: ({ pageParam }) => {
      const cursor = pageParam as string | null | undefined;
      return debateApiGetDebateComments(debateSlug, {
        cursor: cursor,
        limit: 20,
      });
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!debateSlug,
  });

  // Flatten all pages into a single array of comments
  const comments = data?.pages.flatMap((page) => page.items) ?? [];

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <Box className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments
        </h2>
        <div className="flex items-center gap-2">
          {dataUpdatedAt && !isLoading ? (
            <span className="text-xs text-gray-500">
              Updated at {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefetching || isLoading}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <CommentForm debateSlug={debateSlug} />

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {isError && (
        <div className="text-center text-gray-400 py-8">
          Failed to load comments. Please try again.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No comments yet. Be the first to share your thoughts!
              </div>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  debateSlug={debateSlug}
                />
              ))
            )}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More Comments"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </Box>
  );
};

const CommentItem = ({
  comment,
  debateSlug,
}: {
  comment: CommentSchema;
  debateSlug: string;
}) => {
  const {
    id,
    text,
    author,
    date_added,
    vote_score = 0,
    user_vote = 0,
  } = comment;
  const [optimisticVoteScore, setOptimisticVoteScore] = useState(vote_score);
  const [optimisticUserVote, setOptimisticUserVote] =
    useState<VoteDirectionEnum>(user_vote || 0);
  const { authStatus } = useAuthState();
  const router = useRouter();
  const { mutateAsync: vote } = useDebateApiVoteOnComment();

  const formattedDate = new Date(date_added).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const voteHandler = (direction: VoteDirectionEnum) => {
    if (authStatus === "loading") {
      // Do nothing while auth status is loading
      return;
    } else if (authStatus === "unauthenticated") {
      // Redirect to log in if not authenticated
      router.push(`/login?next=/d/${debateSlug}`);
      return;
    }

    // Immediate optimistic UI update
    const currentVote = optimisticUserVote;
    const scoreDelta = direction - currentVote;

    setOptimisticVoteScore((prev) => prev + scoreDelta);
    setOptimisticUserVote(direction);

    // Server update
    vote({ debateSlug, commentId: id!, data: { direction } })
      .then(() => {
        console.log("Vote updated successfully");
      })
      .catch((err) => {
        console.error("Vote update failed:", err);

        // Rollback optimistic update on error
        setOptimisticVoteScore((prev) => prev - scoreDelta);
        setOptimisticUserVote(currentVote);
      });
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm text-white font-medium">
            {author.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-white font-medium">{author.username}</span>
            <time className="block text-xs text-gray-400" dateTime={date_added}>
              {formattedDate}
            </time>
          </div>
        </div>

        <VoteIndicator
          voteScore={optimisticVoteScore}
          userVote={optimisticUserVote}
          size={"md"}
          onVote={voteHandler}
          disabled={authStatus === "loading"}
        />
      </div>

      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
};
