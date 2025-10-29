"use client";

import React, { useState } from "react";
import { DiscussionList } from "./DiscussionList";
import { Loader2, ArrowLeft, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/providers/authProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DiscussionPageClientProps {
  discussionId: number;
  children: React.ReactNode;
}

export const DiscussionPageClientWrapper = ({
  discussionId,
  children,
}: DiscussionPageClientProps) => {
  const { user, isLoading: userLoading, error: userError } = useAuthState();
  const currentUserId = user?.id;

  // Only used on mobile to toggle which panel is visible.
  const [showMobileDiscussionList, setShowMobileDiscussionList] =
    useState(false);

  const handleDiscussionSelect = () => {
    setShowMobileDiscussionList(false);
  };

  const handleBackToDiscussions = () => {
    setShowMobileDiscussionList(true);
  };

  if (userLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userError || !user || !currentUserId) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircleIcon />
          <AlertTitle>Error loading user information</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while fetching user data. Please try
            refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
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
          currentUserId={currentUserId}
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
  );
};
