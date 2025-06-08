"use client";

import {
  VoteIndicator,
  VoteIndicatorProps,
} from "@/components/ui/VoteIndicator";
import { useDebateApiVoteOnDebate } from "@/lib/api/debate";
import { useState } from "react";
import { VoteDirectionEnum } from "@/lib/models";

interface DebateVoteProps
  extends Omit<VoteIndicatorProps, "voteScore" | "userVote" | "onVote"> {
  debateSlug: string;
  initialVoteScore: number;
  initialUserVote: VoteDirectionEnum;
}

const DebateVote = ({
  debateSlug,
  initialVoteScore,
  initialUserVote,
  ...props
}: DebateVoteProps) => {
  // Local state for optimistic updates
  const [optimisticVoteScore, setOptimisticVoteScore] =
    useState(initialVoteScore);
  const [optimisticUserVote, setOptimisticUserVote] =
    useState<VoteDirectionEnum>(initialUserVote || 0);
  const { mutateAsync: vote } = useDebateApiVoteOnDebate();

  const voteHandler = (direction: 1 | -1 | 0) => {
    // Immediate optimistic UI update
    const currentVote = optimisticUserVote;
    const scoreDelta = direction - currentVote;

    setOptimisticVoteScore((prev) => prev + scoreDelta);
    setOptimisticUserVote(direction);

    // Server update
    vote({ debateSlug, data: { direction } })
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
    <VoteIndicator
      {...props}
      voteScore={optimisticVoteScore}
      userVote={optimisticUserVote}
      onVote={voteHandler}
    />
  );
};
export { DebateVote };
