import { useEffect, useRef, useCallback } from "react";
import {
  InfiniteData,
  QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { useWebSocket } from "./websocket";
import WebSocketManager, { WebSocketMessage } from "./websocketManager";
import type {
  MessageSchema,
  DiscussionSchema,
  PagedMessageSchema,
  PagedDiscussionSchema,
} from "@/lib/models";
import {
  insertNewDiscussion,
  upsertDiscussionOnMessage,
} from "./helpers/upsertDiscussion";
import {
  getDiscussionApiGetDiscussionsQueryKey,
  getDiscussionApiGetDiscussionMessagesQueryKey,
  getDiscussionApiGetMessagesUnreadCountQueryKey,
  getDiscussionApiGetUnreadCountForDiscussionQueryKey,
} from "@/lib/api/discussions";

export interface NewMessageData {
  isin_archived_discussion: boolean;
  message: MessageSchema;
}

interface UseDiscussionWebSocketOptions {
  discussionId: number; // Required to send messages to specific discussion, doesn't affect receiving
  onNewMessage?: (message: NewMessageData) => void;
  onMessageRead?: (messageId: string, userId: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

class DiscussionWebSocketManager {
  private static instance: DiscussionWebSocketManager;
  private openedDiscussionId: number | null = null;
  private wsManager: WebSocketManager;
  private hasInitialized: boolean = false;
  private queryClient: QueryClient | null = null;

  private constructor() {
    this.wsManager = WebSocketManager.getInstance();
  }

  static getInstance(): DiscussionWebSocketManager {
    if (!DiscussionWebSocketManager.instance) {
      DiscussionWebSocketManager.instance = new DiscussionWebSocketManager();
    }
    return DiscussionWebSocketManager.instance;
  }

  setQueryClient(queryClient: QueryClient): void {
    this.queryClient = queryClient;
  }

  initialize(openedDiscussionId?: number): void {
    // update the opened discussion id if provided
    if (openedDiscussionId !== undefined) {
      this.openedDiscussionId = openedDiscussionId;
    }

    if (this.hasInitialized) return;

    // Set up the single internal handler for discussion messages
    this.wsManager.addStreamHandler("discussion", (payload) => {
      this.handleMessage(payload);
    });

    this.hasInitialized = true;
  }

  private handleMessage(payload: WebSocketMessage): void {
    // Check for proper message structure with status and event_type
    if (payload.status !== "success" || !payload.event_type) {
      console.error("Invalid WebSocket message format:", payload);
      return;
    }

    const { event_type, data } = payload;

    // Process message based on event_type and emit corresponding events
    switch (event_type) {
      case "new_message":
        this.handleNewMessage(data);
        this.wsManager.emit(`discussion:newMessage`, data);
        break;

      case "read_messages":
        this.handleReadMessages(data);
        this.wsManager.emit(
          `discussion:messageRead`,
          data.discussion_id,
          data.user_id,
        );
        break;

      case "new_discussion":
        this.handleNewDiscussion(data);
        this.wsManager.emit(`discussion:newDiscussion`, data);
    }
  }

  private handleNewMessage(data: {
    message: MessageSchema;
    isin_archived_discussion: boolean;
  }): void {
    if (!this.queryClient) return;

    const { message } = data;
    const discussionId = message.discussion;

    // Invalidate unread count queries
    void this.queryClient.invalidateQueries({
      queryKey: getDiscussionApiGetMessagesUnreadCountQueryKey(),
    });
    void this.queryClient.invalidateQueries({
      queryKey:
        getDiscussionApiGetUnreadCountForDiscussionQueryKey(discussionId),
    });

    // Update the messages cache for infinite query
    // Only if the message belongs to the currently opened discussion
    // Otherwise, there is no need to update the messages cache
    if (discussionId === this.openedDiscussionId) {
      this.queryClient.setQueryData<InfiniteData<PagedMessageSchema>>(
        getDiscussionApiGetDiscussionMessagesQueryKey(discussionId),
        (oldData) => {
          if (!oldData?.pages) {
            // if there is no old data, this means that there isnt any messages yet
            // Therefore, we will return the new message as the first page by itself
            return {
              pageParams: [null],
              pages: [
                {
                  items: [message],
                  next_cursor: null, // It is the first message, so no next cursor
                  current_cursor: null,
                  count: 1,
                },
              ],
            };
          }

          const updatedPages: PagedMessageSchema[] = [...oldData.pages];
          updatedPages[0] = {
            ...updatedPages[0],
            items: [message, ...updatedPages[0].items],
            count: updatedPages[0].count + 1, // Increment total count for this page, not really needed but good to do. The other pages count will remain outdated until refetch
          };
          // Note: you will notice that we didnt change the next_cursor or current_cursor
          // This is because we are adding the message to the start of the list, not the end
          // However, if we ever decide to implement bidirectional pagination, we will need to
          // update the cursors accordingly

          return {
            ...oldData,
            pages: updatedPages,
          };
        },
      );
    }

    // Update the discussions list cache
    upsertDiscussionOnMessage({
      queryClient: this.queryClient,
      discussionId,
      message,
      markAsRead: discussionId === this.openedDiscussionId,
    })
      .then(() =>
        console.log(
          `Upserted discussion ${discussionId} on new message ${message.id}`,
        ),
      )
      .catch((error) => {
        console.error(
          "Failed to upsert discussion on new message:",
          discussionId,
          error,
        );
        console.warn("As a fallback, invalidating discussions list");
        this.fallbackClearDiscussionsAndRefetch();
      });
  }

  private handleNewDiscussion(data: {
    discussion_id: number;
    from_invite: boolean;
  }): void {
    if (!this.queryClient) return;

    const { discussion_id: discussionId } = data;

    insertNewDiscussion({ queryClient: this.queryClient, discussionId })
      .then(() => {
        console.log(`Inserted new discussion ${discussionId}`);
      })
      .catch((error) => {
        console.error(
          `Failed to insert new discussion ${discussionId}:`,
          error,
        );
        console.warn("As a fallback, invalidating discussions list");
        this.fallbackClearDiscussionsAndRefetch();
      });
  }

  private fallbackClearDiscussionsAndRefetch(): void {
    // Slice to keep only the first page, to avoid refetching too many pages
    this.queryClient?.setQueryData(
      getDiscussionApiGetDiscussionsQueryKey(),
      (data: InfiniteData<PagedDiscussionSchema>) => ({
        pages: data.pages.slice(0, 1),
        pageParams: data.pageParams.slice(0, 1),
      }),
    );
    this.queryClient?.invalidateQueries({
      queryKey: getDiscussionApiGetDiscussionsQueryKey(),
    });
  }

  private handleReadMessages(data: {
    discussion_id: number;
    user_id: number;
    is_archived: boolean;
    num_messages_read: number;
    through_load_discussion: boolean;
  }): void {
    if (!this.queryClient) return;

    const { discussion_id } = data;

    // Update discussion unread status
    this.queryClient.setQueryData<InfiniteData<PagedDiscussionSchema>>(
      getDiscussionApiGetDiscussionsQueryKey(),
      (oldData) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
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
    void this.queryClient.invalidateQueries({
      queryKey: getDiscussionApiGetMessagesUnreadCountQueryKey(),
    });
    void this.queryClient.invalidateQueries({
      queryKey:
        getDiscussionApiGetUnreadCountForDiscussionQueryKey(discussion_id),
    });
  }
}

export function useDiscussionWebSocket({
  discussionId,
  onNewMessage,
  onMessageRead,
  onConnect,
  onDisconnect,
}: UseDiscussionWebSocketOptions) {
  const queryClient = useQueryClient();
  const discussionManager = useRef(DiscussionWebSocketManager.getInstance());
  const wsManager = useRef(WebSocketManager.getInstance());
  const cleanupFns = useRef<Array<() => void>>([]);

  // Initialize the discussion manager (only happens once)
  useEffect(() => {
    discussionManager.current.setQueryClient(queryClient);
    discussionManager.current.initialize(discussionId);
  }, [queryClient, discussionId]);

  // Use the base WebSocket hook to ensure connection with stream parameter
  const { send, connectionStatus } = useWebSocket({
    stream: "discussion",
    onConnect,
    onDisconnect,
    autoConnect: true,
  });

  useEffect(() => {
    // Subscribe to discussion-specific events
    if (onNewMessage) {
      cleanupFns.current.push(
        wsManager.current.subscribe(`discussion:newMessage`, onNewMessage),
      );
    }

    if (onMessageRead) {
      cleanupFns.current.push(
        wsManager.current.subscribe(`discussion:messageRead`, onMessageRead),
      );
    }

    // Cleanup
    return () => {
      cleanupFns.current.forEach((cleanup) => cleanup());
      cleanupFns.current = [];
    };
  }, [onNewMessage, onMessageRead]);

  // Discussion-specific send methods
  const sendMessage = useCallback(
    (content: string) => {
      send({
        event_type: "new_message",
        data: {
          discussion_id: discussionId,
          message: content,
        },
      });
    },
    [discussionId, send],
  );

  const markMessagesAsRead = useCallback(
    (throughLoadDiscussion: boolean = false) => {
      send({
        event_type: "read_messages",
        data: {
          discussion_id: discussionId,
          through_load_discussion: throughLoadDiscussion,
        },
      });
    },
    [discussionId, send],
  );

  return {
    sendMessage,
    markMessagesAsRead,
    connectionStatus,
  };
}
