"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  discussionApiGetDiscussionMessages,
  getDiscussionApiGetDiscussionMessagesQueryKey,
  useDiscussionApiGetDiscussion,
} from "@/lib/api/discussions";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { Send, Loader2, AlertCircle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AIMessageChunkData,
  AIMessageThinkingData,
  NewMessageData,
  useDiscussionWebSocket,
} from "@/lib/hooks/ws/discussionWebsocket";
import { PagedMessageSchema } from "@/lib/models";
import { useAuthState } from "@/providers/authProvider";
import { useParams } from "next/navigation";
import { ChatMessageGroups } from "@/app/chat/[discussion_id]/components/ChatMessageGroups";
import { AiBadge } from "@/components/AiBadge";
import { getParticipantDisplayName, OPENNOESIS_AI_DISPLAY_NAME } from "@/lib/ai";

const AI_RESPONSE_TIMEOUT_MS = 20_000;

const ChatConversation = () => {
  const { discussion_id: discussionIdString } = useParams<{
    discussion_id: string;
  }>();
  const discussionId = parseInt(discussionIdString, 10); // this should always be valid here as the root layout already checks it
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAwaitingAiResponse, setIsAwaitingAiResponse] = useState(false);
  const [aiResponseTimedOut, setAiResponseTimedOut] = useState(false);
  const [streamingAiText, setStreamingAiText] = useState("");
  const [streamingAiStartedAt, setStreamingAiStartedAt] = useState<
    string | null
  >(null);
  const [failedAiDraftText, setFailedAiDraftText] = useState("");
  const [failedAiDraftStartedAt, setFailedAiDraftStartedAt] = useState<
    string | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadOnIntersectionTargetRef = useRef<HTMLDivElement>(null);
  const aiResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingAiTextRef = useRef("");
  const streamingAiStartedAtRef = useRef<string | null>(null);
  const { user } = useAuthState();
  if (!user)
    throw new Error("User must be authenticated to view ChatConversation");
  const currentUserId = user.id!; // Assumed to be defined since user is authenticated (from parent AuthRequired)

  // We use a ref to prevent circular dependencies in useCallback
  // for onNewMessage since it is passed to the WS hook but itself calls
  // markMessagesAsRead which is returned by the WS hook.
  // TODO: find a cleaner way to do this
  const markMessagesAsReadRef = useRef<() => void>(() => {
    console.log("markMessagesAsReadRef not set");
  });

  const scrollToBottom = useCallback(() => {
    console.log("Scrolling to bottom");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const {
    data: discussion,
    isLoading: discussionLoading,
    error: discussionError,
  } = useDiscussionApiGetDiscussion(discussionId);

  const clearAiResponseTimeout = useCallback(() => {
    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
      aiResponseTimeoutRef.current = null;
    }
  }, []);

  const moveStreamingDraftToFailed = useCallback(() => {
    const currentText = streamingAiTextRef.current;
    if (!currentText) return;
    setFailedAiDraftText(currentText);
    setFailedAiDraftStartedAt(
      streamingAiStartedAtRef.current ?? new Date().toISOString(),
    );
    setStreamingAiText("");
    setStreamingAiStartedAt(null);
  }, []);

  const startAiResponseTimeout = useCallback(() => {
    clearAiResponseTimeout();
    aiResponseTimeoutRef.current = setTimeout(() => {
      setIsAwaitingAiResponse(false);
      setIsAiThinking(false);
      setAiResponseTimedOut(true);
      moveStreamingDraftToFailed();
    }, AI_RESPONSE_TIMEOUT_MS);
  }, [clearAiResponseTimeout, moveStreamingDraftToFailed]);

  const onNewMessage = useCallback(
    (message: NewMessageData) => {
      if (message.message.discussion !== discussionId) return;

      if (streamingAiTextRef.current && message.message.author !== currentUserId) {
        setStreamingAiText("");
        setStreamingAiStartedAt(null);
        setFailedAiDraftText("");
        setFailedAiDraftStartedAt(null);
        setIsAiThinking(false);
        setIsAwaitingAiResponse(false);
        setAiResponseTimedOut(false);
        clearAiResponseTimeout();
      }

      if (!messagesEndRef.current) {
        console.warn(
          "Received a discussion event too soon. The custom handler will be skipped.",
        );
        return;
      }

      if (message.message.author !== currentUserId) {
        setIsAwaitingAiResponse(false);
        setAiResponseTimedOut(false);
        setFailedAiDraftText("");
        setFailedAiDraftStartedAt(null);
        clearAiResponseTimeout();
        markMessagesAsReadRef.current();
      }

      const containerScrollPosition =
        messagesEndRef.current.parentElement?.parentElement?.scrollTop ?? 0;
      if (containerScrollPosition < 200) {
        scrollToBottom();
      }
    },
    [
      clearAiResponseTimeout,
      currentUserId,
      discussionId,
      scrollToBottom,
    ],
  );

  const onAiMessageChunk = useCallback(
    (chunk: AIMessageChunkData) => {
      if (chunk.discussion_id !== discussionId) return;
      if (!chunk.current_text) return;

      setIsAwaitingAiResponse(true);
      setAiResponseTimedOut(false);
      setFailedAiDraftText("");
      setFailedAiDraftStartedAt(null);
      setStreamingAiText(chunk.current_text);
      setStreamingAiStartedAt((prev) => prev ?? new Date().toISOString());
      startAiResponseTimeout();

      const containerScrollPosition =
        messagesEndRef.current?.parentElement?.parentElement?.scrollTop ?? 0;
      if (containerScrollPosition < 200) {
        scrollToBottom();
      }
    },
    [discussionId, scrollToBottom, startAiResponseTimeout],
  );

  const onAiMessageThinking = useCallback(
    (data: AIMessageThinkingData) => {
      if (data.discussion_id !== discussionId) return;
      setIsAiThinking(data.is_thinking);
      if (!data.is_thinking) {
        setIsAwaitingAiResponse(false);
        if (!streamingAiTextRef.current) {
          clearAiResponseTimeout();
        }
      } else {
        setIsAwaitingAiResponse(true);
      }
    },
    [discussionId, clearAiResponseTimeout],
  );

  const { sendMessage, markMessagesAsRead, connectionStatus } =
    useDiscussionWebSocket({
      discussionId,
      onNewMessage,
      onAiMessageChunk,
      onAiMessageThinking,
    });
  markMessagesAsReadRef.current = markMessagesAsRead;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    error: messagesError,
  } = useInfiniteQuery<PagedMessageSchema>({
    queryKey: getDiscussionApiGetDiscussionMessagesQueryKey(discussionId),
    queryFn: ({ pageParam = null }) => {
      const cursor = pageParam as string | null | undefined;
      return discussionApiGetDiscussionMessages(discussionId, { cursor });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.next_cursor ?? undefined;
    },
    initialPageParam: null,
    enabled: !!discussionId,
  });

  // This represents the messages from the latest to the oldest
  const messages = data?.pages.flatMap((page) => page.items) ?? [];
  useEffect(() => {
    streamingAiTextRef.current = streamingAiText;
    streamingAiStartedAtRef.current = streamingAiStartedAt;
  }, [streamingAiText, streamingAiStartedAt]);
  const isAiTurnInProgress =
    discussion?.is_ai_discussion &&
    (isAwaitingAiResponse || isAiThinking || !!streamingAiText);

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

  const onUserMessageSent = useCallback(() => {
    if (!discussion?.is_ai_discussion) return;
    setAiResponseTimedOut(false);
    setFailedAiDraftText("");
    setFailedAiDraftStartedAt(null);
    setIsAwaitingAiResponse(true);
    startAiResponseTimeout();
  }, [discussion?.is_ai_discussion, startAiResponseTimeout]);

  const handleSendMessage = useCallback(async () => {
    if (
      !newMessage.trim() ||
      isSending ||
      isAiTurnInProgress ||
      !discussionId ||
      connectionStatus !== "connected"
    )
      return;

    setIsSending(true);
    try {
      sendMessage(newMessage.trim());
      onUserMessageSent();
      setNewMessage("");
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Failed to send message:", error);
      // This is pretty rare, the only error that can happen is if the WS connection closes while sending
    } finally {
      setIsSending(false);
    }
  }, [
    newMessage,
    isSending,
    discussionId,
    connectionStatus,
    sendMessage,
    scrollToBottom,
    isAiTurnInProgress,
    onUserMessageSent,
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
      markMessagesAsRead(true);
    }
  }, [discussion?.id, discussion?.is_unread, markMessagesAsRead]);

  useEffect(() => {
    setIsAwaitingAiResponse(false);
    setIsAiThinking(false);
    setAiResponseTimedOut(false);
    setStreamingAiText("");
    setStreamingAiStartedAt(null);
    setFailedAiDraftText("");
    setFailedAiDraftStartedAt(null);
    clearAiResponseTimeout();
  }, [discussionId, clearAiResponseTimeout]);

  useEffect(() => {
    return () => {
      clearAiResponseTimeout();
    };
  }, [clearAiResponseTimeout]);

  // It is possible that the discussion info or the messages are loading
  if (discussionLoading || messagesLoading) {
    return (
      <div className={"h-full flex items-center justify-center flex-1"}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (discussionError || messagesError) {
    return (
      <div className={"h-full flex items-center justify-center p-8 flex-1"}>
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
  const participantDisplayName = getParticipantDisplayName(
    otherParticipant.username,
    discussion.is_ai_discussion ?? false,
  );
  const messagesWithStreaming =
    streamingAiText && streamingAiStartedAt
      ? [
          {
            id: "streaming-ai",
            discussion: discussionId,
            author: otherParticipant.id!,
            text: streamingAiText,
            created_at: streamingAiStartedAt,
          },
          ...messages,
        ]
      : failedAiDraftText
        ? [
            {
              id: "failed-ai-draft",
              discussion: discussionId,
              author: otherParticipant.id!,
              text: failedAiDraftText,
              created_at:
                failedAiDraftStartedAt ?? new Date().toISOString(),
            },
            ...messages,
          ]
        : messages;

  return (
    <div className={"flex flex-col overflow-y-auto flex-1"}>
      {/* Header */}
      <div className="p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <UserAvatar user={otherParticipant} size="large" />
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "font-medium",
                  discussion.is_ai_discussion ? "text-blue-300" : "",
                )}
              >
                {participantDisplayName}
              </h3>
              {discussion.is_ai_discussion && (
                <AiBadge />
              )}
            </div>
            <p className="text-sm text-gray-400 truncate max-w-xs">
              {discussion.debate.title}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-6 space-y-4 flex flex-col-reverse pt-4"
        ref={containerRef}
      >
        <div ref={messagesEndRef} />

        {discussion.is_ai_discussion && isAiThinking && !streamingAiText && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{OPENNOESIS_AI_DISPLAY_NAME} is thinking...</span>
            </div>
          </div>
        )}

        {messagesWithStreaming.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-lg font-medium mb-2">Start the conversation</p>
            <p className="text-sm">
              Send the first message to begin your debate!
            </p>
          </div>
        ) : (
          <ChatMessageGroups
            messages={messagesWithStreaming}
            currentUserId={currentUserId}
            gapMinutes={15}
          />
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

        {connectionStatus === "disconnecting" && (
          <p className="text-xs text-gray-400 mb-2">
            Disconnecting from discussion...
          </p>
        )}

        {connectionStatus === "connected" && (
          <div className="text-xs text-green-500 mb-2 flex items-center gap-1">
            <CircleCheck className="w-3 h-3" />
            <span>Connected to discussion.</span>
          </div>
        )}
        {discussion.is_ai_discussion && aiResponseTimedOut && (
          <p className="text-xs text-amber-500 mb-2">
            AI did not respond in time. You can send another message.
          </p>
        )}
        {discussion.is_ai_discussion && failedAiDraftText && (
          <p className="text-xs text-amber-500 mb-2">
            AI response was interrupted. Partial reply is shown above.
          </p>
        )}
        <form className="flex items-end space-x-3" autoComplete={"off"}>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-32 resize-none border-gray-200 rounded-xl"
            disabled={isSending || connectionStatus !== "connected"}
          />
          <button
            onClick={handleSendMessage}
            disabled={
              !newMessage.trim() ||
              isSending ||
              !!isAiTurnInProgress ||
              connectionStatus !== "connected"
            }
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              newMessage.trim() && connectionStatus === "connected"
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
        </form>
      </div>
    </div>
  );
};

export default ChatConversation;
