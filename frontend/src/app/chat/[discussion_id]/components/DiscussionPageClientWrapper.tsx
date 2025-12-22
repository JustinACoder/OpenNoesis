"use client";

import React, { useState } from "react";
import { DiscussionList } from "./DiscussionList";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthRequired } from "@/components/AuthRedirects";

interface DiscussionPageClientProps {
  discussionId: number;
  children: React.ReactNode;
}

export const DiscussionPageClientWrapper = ({
  discussionId,
  children,
}: DiscussionPageClientProps) => {
  // Only used on mobile to toggle which panel is visible.
  const [showMobileDiscussionList, setShowMobileDiscussionList] =
    useState(false);

  const handleDiscussionSelect = () => {
    setShowMobileDiscussionList(false);
  };

  const handleBackToDiscussions = () => {
    setShowMobileDiscussionList(true);
  };

  return (
    <AuthRequired>
      <div className="flex flex-col md:flex-row h-full">
        {/* Discussion List Panel */}
        <div
          className={`
          ${showMobileDiscussionList ? "flex" : "hidden"}
          md:flex w-full md:w-100 h-full
        `}
        >
          <DiscussionList
            selectedDiscussionId={discussionId}
            onDiscussionSelect={handleDiscussionSelect}
          />
        </div>

        {/* Conversation Panel (always mounted, just hidden on mobile when list is shown) */}
        <div
          className={`
          ${showMobileDiscussionList ? "hidden" : "flex"}
          flex-1 flex-col h-full
        `}
        >
          {/* Mobile header */}
          <div className="md:hidden flex items-center p-2 border-b bg-background/95">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDiscussions}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">Back to discussions</span>
          </div>

          {children}
        </div>
      </div>
    </AuthRequired>
  );
};
