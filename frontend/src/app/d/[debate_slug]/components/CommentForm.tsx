"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { useDebateApiCreateComment } from "@/lib/api/debate";
import { CommentInputSchema } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CommentFormProps {
  debateSlug: string;
}

export const CommentForm = ({ debateSlug }: CommentFormProps) => {
  const [content, setContent] = useState("");
  const { mutateAsync, isPending } = useDebateApiCreateComment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isPending) return;

    try {
      const commentData: CommentInputSchema = {
        text: content.trim(),
      };
      await mutateAsync({
        debateSlug: debateSlug,
        data: commentData,
      });
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
