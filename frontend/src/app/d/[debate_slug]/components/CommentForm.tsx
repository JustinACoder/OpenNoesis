"use client";

import React, { useState } from "react";
import { AlertCircleIcon, Loader2, Send } from "lucide-react";
import {
  CommentInputSchema,
  type CommentSchema,
  type PagedCommentSchema,
} from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthState } from "@/providers/authProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import {
  getDebateApiGetDebateCommentsQueryKey,
  useDebateApiCreateComment,
} from "@/lib/api/debate";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CommentFormProps {
  debateSlug: string;
}

export const CommentForm = ({ debateSlug }: CommentFormProps) => {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const { mutate: createComment, isPending } = useDebateApiCreateComment({
    mutation: {
      onSuccess: (newComment: CommentSchema) => {
        // Update the infinite query cache by adding the new comment at the beginning
        queryClient.setQueryData<InfiniteData<PagedCommentSchema>>(
          getDebateApiGetDebateCommentsQueryKey(debateSlug),
          (oldData) => {
            if (!oldData) {
              // If no data exists, create initial structure with the new comment
              return {
                pages: [
                  {
                    items: [newComment],
                    count: 1,
                    next_cursor: null,
                    current_cursor: null,
                  },
                ],
                pageParams: [undefined],
              };
            }

            // Add the new comment to the beginning of the first page
            const firstPage = oldData.pages[0];
            return {
              ...oldData,
              pages: [
                {
                  ...firstPage,
                  items: [newComment, ...firstPage.items],
                  count: firstPage.count + 1,
                },
                ...oldData.pages.slice(1),
              ],
            };
          },
        );

        // Clear the textarea
        setContent("");
      },
      onError: () => {
        toast.error("Failed to post comment. Please try again.");
      },
    },
  });

  const { authStatus } = useAuthState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isPending) return;

    const commentData: CommentInputSchema = {
      text: content.trim(),
    };

    createComment({ debateSlug, data: commentData });
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
