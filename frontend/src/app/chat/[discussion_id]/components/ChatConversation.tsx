import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  discussionApiGetDiscussionMessages,
  getDiscussionApiGetDiscussionMessagesQueryKey,
  useDiscussionApiGetDiscussion,
} from "@/lib/api/discussions";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { Send, Loader2, AlertCircle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiscussionWebSocket } from "@/lib/hooks/useDiscussionWebSocket";

interface ChatConversationProps {
  discussionId: number;
  currentUserId?: number | null;
  className?: string;
}

export const ChatConversation = ({
  discussionId,
  currentUserId,
  className,
}: ChatConversationProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadOnIntersectionTargetRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    console.log("Scrolling to bottom");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const postEventHandler = useCallback(
    (event_type: string, data: any) => {
      console.log("Received event:", event_type, data);
      if (event_type === "new_message") {
        if (!messagesEndRef.current) {
          console.warn(
            "Received a discussion event too soon. It will be ignored.",
          );
          return;
        }

        // ScrollTop is 0 when we are at the bottom because of flex-col-reverse
        const containerScrollPosition =
          messagesEndRef.current.parentElement?.parentElement?.scrollTop ?? 0;
        if (containerScrollPosition < 200) {
          scrollToBottom();
        }
      }
    },
    [scrollToBottom],
  );

  const { sendMessage, markMessagesAsRead, connectionStatus, isConnected } =
    useDiscussionWebSocket({ postEventHandler });

  const {
    data: discussion,
    isLoading: discussionLoading,
    error: discussionError,
  } = useDiscussionApiGetDiscussion(discussionId);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    error: messagesError,
  } = useInfiniteQuery({
    queryKey: getDiscussionApiGetDiscussionMessagesQueryKey(discussionId),
    queryFn: ({ pageParam = 1 }) =>
      discussionApiGetDiscussionMessages(discussionId, { page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length === 0) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!discussionId,
  });

  // This represents the messages from the latest to the oldest
  const messages = data?.pages.flatMap((page) => page.items) ?? [];

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const io = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        },
        {
          root: node,
          threshold: 0,
        },
      );

      if (loadOnIntersectionTargetRef.current) {
        io.observe(loadOnIntersectionTargetRef.current);
      }

      const handleScroll = () => {
        console.log("Scroll event detected");
        //void node.offsetHeight; // Trigger a reflow, flushing the CSS changes
      };
      node.addEventListener("scroll", handleScroll);
      return () => {
        node.removeEventListener("scroll", handleScroll);
        io.disconnect();
      };
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || isSending || !discussionId || !isConnected)
      return;

    setIsSending(true);
    try {
      const success = sendMessage(discussionId, newMessage.trim());
      if (success) {
        setNewMessage("");
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  }, [
    newMessage,
    isSending,
    discussionId,
    isConnected,
    sendMessage,
    scrollToBottom,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  useEffect(() => {
    if (discussion?.id && discussion.is_unread) {
      markMessagesAsRead(discussion.id, true);
    }
  }, [discussion?.id, discussion?.is_unread, markMessagesAsRead]);

  if (discussionLoading || messagesLoading) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (discussionError || messagesError) {
    return (
      <div
        className={cn("h-full flex items-center justify-center p-8", className)}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">
            Error Loading Discussion
          </h3>
          <p className="text-sm text-gray-600">
            There was an error loading this discussion. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return null;
  }

  const getOtherParticipant = () => {
    return discussion.participant1.id === currentUserId
      ? discussion.participant2
      : discussion.participant1;
  };

  const otherParticipant = getOtherParticipant();

  return (
    <div className={cn("flex flex-col overflow-y-auto", className)}>
      {/* Header */}
      <div className="p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <UserAvatar user={otherParticipant} size="large" />
          <div>
            <h3 className="font-medium">{otherParticipant.username}</h3>
            <p className="text-sm text-gray-400 truncate max-w-xs">
              {discussion.debate.title}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-6 space-y-4 flex flex-col-reverse pt-4"
        style={{ scrollbarColor: "var(--secondary) transparent" }}
        ref={containerRef}
      >
        <div ref={messagesEndRef} />

        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-lg font-medium mb-2">Start the conversation</p>
            <p className="text-sm">
              Send the first message to begin your debate!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.author === currentUserId;

            return (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  isOwnMessage ? "justify-end" : "justify-start",
                )}
              >
                <div className={cn("max-w-xs lg:max-w-md xl:max-w-lg")}>
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl w-fit ml-auto",
                      isOwnMessage
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900",
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-xs text-gray-400 mt-1 px-1",
                      isOwnMessage ? "text-right" : "text-left",
                    )}
                  >
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        <div ref={loadOnIntersectionTargetRef} className="h-px" />

        {hasNextPage && (
          <div className="text-center py-2">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="px-6 pb-4">
        {connectionStatus === "connecting" && (
          <p className="text-xs text-gray-400 mb-2">
            Connecting to discussion...
          </p>
        )}
        {connectionStatus === "disconnected" && (
          <p className="text-xs text-gray-400 mb-2">
            Disconnected from discussion.
          </p>
        )}

        {connectionStatus === "error" && (
          <p className="text-xs text-red-500 mb-2">
            Error connecting to discussion. Please try again later.
          </p>
        )}

        {connectionStatus === "connected" && (
          <div className="text-xs text-green-500 mb-2 flex items-center gap-1">
            <CircleCheck className="w-3 h-3" />
            <span>Connected to discussion.</span>
          </div>
        )}
        <div className="flex items-end space-x-3">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-32 resize-none border-gray-200 rounded-xl"
            disabled={isSending || !isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending || !isConnected}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              newMessage.trim() && isConnected
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-gray-200 text-gray-400",
            )}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
