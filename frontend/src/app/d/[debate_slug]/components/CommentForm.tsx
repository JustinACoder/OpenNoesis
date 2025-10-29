"use client";

import React, { useState } from "react";
import { AlertCircleIcon, Loader2, Send } from "lucide-react";
import {
  useDebateApiCreateComment,
  getDebateApiGetDebateCommentsQueryKey,
} from "@/lib/api/debate";
import {
  CommentInputSchema,
  CommentSchema,
  PagedCommentSchema,
} from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useOptimisticMutation } from "@/lib/utils";
import { useAuthState } from "@/providers/authProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

interface CommentFormProps {
  debateSlug: string;
}

export const CommentForm = ({ debateSlug }: CommentFormProps) => {
  const [content, setContent] = useState("");
  // TODO: adapt logic with infinite query for comments pagination
  const { mutate: createComment, isPending } = useOptimisticMutation<
    PagedCommentSchema,
    { debateSlug: string; data: CommentInputSchema },
    CommentSchema
  >(useDebateApiCreateComment, {
    queryKey: getDebateApiGetDebateCommentsQueryKey(debateSlug),
    updateFn: (p) => p, // We don't update the comment list optimistically here
    shouldInvalidate: true, // We want to refetch the comment page after creating the new one
  });
  const { authStatus } = useAuthState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isPending) return;

    try {
      const commentData: CommentInputSchema = {
        text: content.trim(),
      };
      createComment({ debateSlug, data: commentData });
      setContent("");
    } catch (error) {
      console.error("Failed to create comment:", error);
      toast.error("Failed to post comment. Please try again.");
    }
  };

  return authStatus === "unauthenticated" ? (
    <Alert>
      <AlertCircleIcon />
      <AlertTitle>You must be logged in to post comments.</AlertTitle>
      <AlertDescription>
        <p>
          Please{" "}
          <Link href="/login" className="underline text-primary">
            log in
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="underline text-primary">
            sign up
          </Link>{" "}
          to join the discussion.
        </p>
      </AlertDescription>
    </Alert>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts on this debate..."
          className="h-32 bg-gray-700/50"
          maxLength={4500}
          disabled={isPending}
        />
        <Button
          type="submit"
          disabled={!content.trim() || isPending || authStatus === "loading"}
          variant="outline"
          className="absolute bottom-2 right-2"
        >
          {isPending || authStatus === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </form>
  );
};
