"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./useWebSocket";
import type { MessageSchema, DiscussionSchema } from "@/lib/models";
import {
  getDiscussionApiGetDiscussionsQueryKey,
  getDiscussionApiGetDiscussionMessagesQueryKey,
  getDiscussionApiGetMessagesUnreadCountQueryKey,
  getDiscussionApiGetUnreadCountForDiscussionQueryKey,
} from "@/lib/api/discussions";

interface UseDiscussionWebSocketInterface {
  postEventHandler?: (event_type: string, data: any) => void;
}

export const useDiscussionWebSocket = ({
  postEventHandler,
}: UseDiscussionWebSocketInterface = {}) => {
  const queryClient = useQueryClient();

  const handleNewMessage = useCallback(
    (data: { message: MessageSchema; isin_archived_discussion: boolean }) => {
      const { message } = data;
      const discussionId = message.discussion;

      // Update the messages cache for infinite query
      queryClient.setQueryData(
        getDiscussionApiGetDiscussionMessagesQueryKey(discussionId),
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          const updatedPages = [...oldData.pages];
          updatedPages[0] = {
            ...updatedPages[0],
            items: [message, ...updatedPages[0].items],
            count: updatedPages[0].count + 1,
          };

          return {
            ...oldData,
            pages: updatedPages,
          };
        },
      );

      // Update the discussions list cache
      queryClient.setQueryData(
        getDiscussionApiGetDiscussionsQueryKey(),
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              items: page.items
                .map((discussion: DiscussionSchema) => {
                  if (discussion.id === discussionId) {
                    return {
                      ...discussion,
                      latest_message_text: message.text,
                      latest_message_created_at: message.created_at,
                      latest_message_author_id: message.author,
                      latest_activity: message.created_at,
                      is_unread: true, // Will be updated by read_messages event if needed
                    };
                  }
                  return discussion;
                })
                .sort(
                  (a: DiscussionSchema, b: DiscussionSchema) =>
                    new Date(b.latest_activity).getTime() -
                    new Date(a.latest_activity).getTime(),
                ),
            })),
          };
        },
      );

      // Invalidate unread count queries
      void queryClient.invalidateQueries({
        queryKey: getDiscussionApiGetMessagesUnreadCountQueryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey:
          getDiscussionApiGetUnreadCountForDiscussionQueryKey(discussionId),
      });
    },
    [queryClient],
  );

  const handleReadMessages = useCallback(
    (data: {
      discussion_id: number;
      user_id: number;
      is_archived: boolean;
      num_messages_read: number;
      through_load_discussion: boolean;
    }) => {
      const { discussion_id } = data;

      // Update discussion unread status
      queryClient.setQueryData(
        getDiscussionApiGetDiscussionsQueryKey(),
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              items: page.items.map((discussion: DiscussionSchema) => {
                if (discussion.id === discussion_id) {
                  return {
                    ...discussion,
                    is_unread: false,
                  };
                }
                return discussion;
              }),
            })),
          };
        },
      );

      // Invalidate unread count queries
      void queryClient.invalidateQueries({
        queryKey: getDiscussionApiGetMessagesUnreadCountQueryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey:
          getDiscussionApiGetUnreadCountForDiscussionQueryKey(discussion_id),
      });
    },
    [queryClient],
  );

  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (message.status !== "success") {
        console.error("WebSocket error:", message.message);
        return;
      }

      switch (message.event_type) {
        case "new_message":
          handleNewMessage(message.data);
          break;
        case "read_messages":
          handleReadMessages(message.data);
          break;
        default:
          console.log("Unknown WebSocket event:", message.event_type);
      }

      postEventHandler?.(message.event_type, message.data);
    },
    [handleNewMessage, handleReadMessages, postEventHandler],
  );

  // Use the correct WebSocket URL for your demultiplexer setup
  const onConnect = useCallback(
    () => console.log("Discussion WebSocket connected"),
    [],
  );
  const onDisconnect = useCallback(
    () => console.log("Discussion WebSocket disconnected"),
    [],
  );
  const onError = useCallback(
    (error: unknown) => console.error("Discussion WebSocket error:", error),
    [],
  );

  const ws = useWebSocket(`ws://localhost:8000/ws/`, {
    stream: "discussion", // This corresponds to the discussion consumer in your demultiplexer
    onMessage: handleWebSocketMessage,
    onConnect: onConnect,
    onDisconnect: onDisconnect,
    onError: onError,
    reconnectAttempts: 3, // Reduce reconnect attempts to prevent excessive re-renders
    reconnectDelay: 5000, // Increase delay between reconnection attempts
  });

  const sendMessage = useCallback(
    (discussionId: number, message: string) => {
      return ws.sendMessage({
        event_type: "new_message",
        data: {
          discussion_id: discussionId,
          message,
        },
      });
    },
    [ws],
  );

  const markMessagesAsRead = useCallback(
    (discussionId: number, throughLoadDiscussion: boolean = false) => {
      return ws.sendMessage({
        event_type: "read_messages",
        data: {
          discussion_id: discussionId,
          through_load_discussion: throughLoadDiscussion,
        },
      });
    },
    [ws],
  );

  return {
    ...ws,
    sendMessage,
    markMessagesAsRead,
  };
};
