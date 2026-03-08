import React, { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  discussionApiGetDiscussions,
  getDiscussionApiGetDiscussionsQueryKey,
} from "@/lib/api/discussions";
import { DiscussionSchema, PagedDiscussionSchema } from "@/lib/models";
import UserAvatar from "@/components/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuthState } from "@/providers/authProvider";
import { AiBadge } from "@/components/AiBadge";
import { getParticipantDisplayName } from "@/lib/ai";

interface DiscussionListProps {
  selectedDiscussionId?: number;
  onDiscussionSelect: () => void;
}

export const DiscussionList = ({
  selectedDiscussionId,
  onDiscussionSelect,
}: DiscussionListProps) => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery<PagedDiscussionSchema>({
    queryKey: getDiscussionApiGetDiscussionsQueryKey(),
    queryFn: ({ pageParam = null }) => {
      const cursor = pageParam as string | null | undefined;
      return discussionApiGetDiscussions({ cursor });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.next_cursor ?? undefined;
    },
    initialPageParam: null,
  });
  const { user } = useAuthState();
  const currentUserId = user!.id!; // Assumed to be defined since user is authenticated (from parent AuthRequired)

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      if (
        scrollHeight - scrollTop <= clientHeight * 1.5 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        void fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const discussions = data?.pages.flatMap((page) => page.items) ?? [];

  const getOtherParticipant = (discussion: DiscussionSchema) => {
    return discussion.participant1.id === currentUserId
      ? discussion.participant2
      : discussion.participant1;
  };

  const formatLastMessageTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "";
    }
  };

  if (isLoading) {
    return (
      <div className={"h-full flex items-center justify-center flex-1"}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={"h-full flex items-center justify-center p-8 flex-1"}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">
            Error Loading Discussions
          </h3>
          <p className="text-sm text-gray-600">
            There was an error loading your discussions. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (discussions.length === 0) {
    return (
      <div className={"p-8 text-center text-gray-400 h-full flex-1"}>
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No discussions yet</p>
        <p className="text-sm">
          Start a debate to begin chatting with other users!
        </p>
      </div>
    );
  }

  return (
    <div
      className={"flex flex-col overflow-y-auto p-2 shadow-xl h-full flex-1"}
      style={{ scrollbarColor: "var(--secondary) transparent" }}
      onScroll={handleScroll}
    >
      <div className="p-4">
        <h2 className="text-lg font-medium">Messages</h2>
      </div>

      <div className="flex-1">
        {discussions.map((discussion) => {
          const otherParticipant = getOtherParticipant(discussion);
          const participantDisplayName = getParticipantDisplayName(
            otherParticipant.username,
            discussion.is_ai_discussion ?? false,
          );
          const isSelected = discussion.id === selectedDiscussionId;

          return (
            <Link
              key={discussion.id}
              className={`block p-4 cursor-pointer rounded-lg hover:bg-primary/20 transition-colors ${isSelected ? "bg-primary/50" : ""}`}
              href={
                discussion.id !== selectedDiscussionId
                  ? `/chat/${discussion.id}`
                  : "#"
              }
              onNavigate={onDiscussionSelect}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <UserAvatar user={otherParticipant} size="large" />
                  {discussion.is_unread && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm truncate">
                      {participantDisplayName}
                    </p>
                    {discussion.is_ai_discussion && (
                      <AiBadge />
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mb-1 truncate">
                    {discussion.debate.title}
                  </p>

                  {discussion.latest_message_text ? (
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm truncate flex-1 ${discussion.is_unread ? "font-medium text-primary" : "text-gray-400"}`}
                      >
                        {discussion.latest_message_text}
                      </p>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {formatLastMessageTime(
                          discussion.latest_message_created_at,
                        )}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No messages yet
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {isFetchingNextPage && (
          <div className="p-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};
