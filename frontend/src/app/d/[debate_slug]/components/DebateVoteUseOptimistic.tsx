"use client";

import {
  VoteIndicator,
  VoteIndicatorProps,
} from "@/components/ui/VoteIndicator";
import { useDebateApiVoteOnDebate } from "@/lib/api/debate";
import { useOptimisticMutation } from "@/lib/utils";
import { getDebateApiGetDebateQueryKey } from "@/lib/api/debate";
import { DebateFullSchema } from "@/lib/models";

interface DebateVoteProps extends VoteIndicatorProps {
  debateSlug: string;
  onVote?: never;
}

const DebateVote = ({ debateSlug, ...props }: DebateVoteProps) => {
  console.log("DebateVote", debateSlug);
  console.log("User vote props:", props.userVote);
  console.log("Vote score props:", props.voteScore);

  const { mutate: vote } = useOptimisticMutation<
    DebateFullSchema,
    { debateSlug: string; data: { direction: 1 | -1 | 0 } }
  >(useDebateApiVoteOnDebate, {
    queryKey: getDebateApiGetDebateQueryKey(debateSlug),
    updateFn: (debate, variables) => {
      const newVote = variables.data.direction;
      const currentVote = debate.user_vote || 0;
      const scoreDelta = newVote - currentVote;

      console.log(
        `Updating vote for debate ${debateSlug}: currentVote=${currentVote}, newVote=${newVote}, scoreDelta=${scoreDelta}`,
      );

      return {
        ...debate,
        user_vote: newVote,
        vote_score: (debate.vote_score || 0) + scoreDelta,
      };
    },
  });

  const voteHandler = (direction: 1 | -1 | 0) => {
    vote({ debateSlug, data: { direction } });
  };

  return <VoteIndicator {...props} onVote={voteHandler} />;
};
export { DebateVote };
