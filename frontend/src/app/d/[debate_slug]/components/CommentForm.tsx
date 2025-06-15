"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
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

// function useCreateCommentAndUpdateList(debateSlug: string, params: DebateApiGetDebateCommentsParams) {
//   const queryClient = useQueryClient();
//
//   return useDebateApiCreateComment({
//     mutation: {
//       // this handler runs after the POST /comment returns the new comment
//       onSuccess: (createdComment) => {
//         const key = getDebateApiGetDebateCommentsQueryKey(debateSlug, params);
//         queryClient.setQueryData<PagedCommentSchema>(key, old => {
//           if (!old) return old;
//           return {
//             ...old,
//             count: old.count + 1,
//             items: [createdComment, ...old.items],
//           };
//         });
//       },
//     },
//   });
// }

interface CommentFormProps {
  debateSlug: string;
}

export const CommentForm = ({ debateSlug }: CommentFormProps) => {
  const [content, setContent] = useState("");
  const { mutate: createComment, isPending } = useOptimisticMutation<
    PagedCommentSchema,
    { debateSlug: string; data: CommentInputSchema },
    CommentSchema
  >(useDebateApiCreateComment, {
    queryKey: getDebateApiGetDebateCommentsQueryKey(debateSlug),
    updateFn: (p) => p, // We don't update the comment list optimistically here
    shouldInvalidate: true, // We want to refetch the comment page after creating the new one
  });

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

  return (
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
          disabled={!content.trim() || isPending}
          variant="outline"
          className="absolute bottom-2 right-2"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
};
