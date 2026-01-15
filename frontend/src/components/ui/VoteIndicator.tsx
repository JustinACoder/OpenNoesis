"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const voteIndicatorVariants = cva(
  "flex items-center gap-1 text-muted-foreground",
  {
    variants: {
      size: {
        sm: "text-xs [&_button]:h-6 [&_button]:w-6",
        md: "text-sm [&_button]:h-8 [&_button]:w-8",
        lg: "text-base [&_button]:h-10 [&_button]:w-10",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const iconSizeMap: Record<NonNullable<VoteIndicatorProps["size"]>, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
};

interface VoteIndicatorProps
  extends VariantProps<typeof voteIndicatorVariants> {
  voteScore: number;
  userVote?: 1 | -1 | 0;
  onVote?: (vote: 1 | -1 | 0) => void;
  className?: string;
  disabled?: boolean;
}

const VoteIndicator = React.forwardRef<HTMLDivElement, VoteIndicatorProps>(
  (
    {
      voteScore,
      userVote,
      onVote,
      size,
      className,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const handleVote = (vote: 1 | -1) => {
      if (disabled || !onVote) return;

      if (userVote === vote) {
        // If user clicks the same vote they already made, remove their vote
        onVote(0);
      } else {
        // Otherwise, set the new vote
        onVote(vote);
      }
    };

    const getVoteButtonVariant = (voteType: 1 | -1) => {
      if (userVote === voteType) {
        return voteType === 1 ? "default" : "destructive";
      }
      return "ghost";
    };

    const getScoreColor = () => {
      if (voteScore > 0) return "text-green-600 dark:text-green-400";
      if (voteScore < 0) return "text-red-600 dark:text-red-400";
      return "text-muted-foreground";
    };

    return (
      <div
        ref={ref}
        className={cn(voteIndicatorVariants({ size, className }))}
        {...props}
      >
        <Button
          variant={getVoteButtonVariant(1)}
          size="icon"
          onClick={() => handleVote(1)}
          disabled={disabled}
          className={cn(
            "transition-colors",
            userVote === 1 && "bg-green-500 hover:bg-green-600 text-white",
          )}
          aria-label="Upvote"
        >
          <ArrowUp className={iconSizeMap[size ?? "md"]} />{" "}
          {/* TODO: is this the cleanest way to represent this */}
        </Button>

        <span
          className={cn("font-medium tabular-nums min-w-0", getScoreColor())}
        >
          {voteScore > 0 && "+"}
          {voteScore}
        </span>

        <Button
          variant={getVoteButtonVariant(-1)}
          size="icon"
          onClick={() => handleVote(-1)}
          disabled={disabled}
          className={cn(
            "transition-colors",
            userVote === -1 && "bg-red-500 hover:bg-red-600 text-white",
          )}
          aria-label="Downvote"
        >
          <ArrowDown className={iconSizeMap[size ?? "md"]} />{" "}
          {/* TODO: is this the cleanest way to represent this */}
        </Button>
      </div>
    );
  },
);

VoteIndicator.displayName = "VoteIndicator";

export { VoteIndicator, voteIndicatorVariants };
export type { VoteIndicatorProps };
