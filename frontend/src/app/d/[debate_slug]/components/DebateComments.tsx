import { MessageCircle } from "lucide-react";
import { CommentSchema, VoteDirectionEnum } from "@/lib/models";
import { Box } from "@/components/ui/box";
import { CommentForm } from "./CommentForm";
import { VoteIndicator } from "@/components/ui/VoteIndicator";
import { useAuthState } from "@/providers/authProvider";
import { useRouter } from "next/navigation";
import { useDebateApiVoteOnComment } from "@/lib/api/debate";
import { useState } from "react";

interface DebateCommentsProps {
  comments: CommentSchema[];
  debateSlug: string;
}

export const DebateComments = ({
  comments,
  debateSlug,
}: DebateCommentsProps) => {
  return (
    <Box className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments
        </h2>
      </div>

      <CommentForm debateSlug={debateSlug} />

      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            debateSlug={debateSlug}
          />
        ))}
      </div>
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
      // Redirect to login if not authenticated
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
