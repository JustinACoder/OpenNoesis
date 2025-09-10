import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import {
  discussionApiGetDiscussion,
  getDiscussionApiGetDiscussionsQueryKey,
} from "@/lib/api/discussions";
import {
  DiscussionSchema,
  MessageSchema,
  PagedDiscussionSchema,
} from "@/lib/models";
import { useAuth } from "@/providers/authProvider";

type DiscussionsInfinite = InfiniteData<PagedDiscussionSchema>;

// Inserts the given discussion at the top of the first page,
// removes any duplicates from all pages, and initializes the cache if needed.
function insertDiscussionAtTop(
  oldData: DiscussionsInfinite | undefined,
  discussion: DiscussionSchema,
): DiscussionsInfinite {
  if (!oldData?.pages) {
    return {
      pages: [
        {
          items: [discussion],
          next_cursor: null,
          current_cursor: null,
          count: 1,
        },
      ],
      pageParams: [null],
    };
  }

  const updatedPages = oldData.pages.map((page, idx) => {
    const filtered = page.items.filter((d) => d.id !== discussion.id);
    const items = idx === 0 ? [discussion, ...filtered] : filtered;
    return { ...page, items };
  });

  return { ...oldData, pages: updatedPages };
}

export async function upsertDiscussionOnMessage(opts: {
  queryClient: QueryClient;
  discussionId: number;
  message: MessageSchema;
  markAsRead?: boolean;
}) {
  const { queryClient, discussionId, message, markAsRead = false } = opts;

  const listKey = getDiscussionApiGetDiscussionsQueryKey();

  // 1) Inspect current cache
  const list = queryClient.getQueryData<DiscussionsInfinite>(listKey);
  let existing: DiscussionSchema | undefined;
  for (const p of list?.pages ?? []) {
    const match = p.items.find((d) => d.id === discussionId);
    if (match) {
      existing = match;
      break;
    }
  }

  // 2) If missing, fetch the discussion first (async OUTSIDE setQueryData)
  let fetchedDiscussion: DiscussionSchema | undefined;
  if (!existing) {
    fetchedDiscussion = await discussionApiGetDiscussion(discussionId);
  }

  // Make sure we have the discussion now
  if (!existing && !fetchedDiscussion) {
    console.warn(
      "Received message for unknown discussion, and failed to fetch it",
      discussionId,
    );
    return;
  }

  // 3) Update the infinite cache synchronously
  let itemToInsert: DiscussionSchema;
  if (existing) {
    itemToInsert = {
      ...existing,
      latest_message_text: message.text,
      latest_message_created_at: message.created_at,
      latest_message_author_id: message.author,
      latest_activity: message.created_at,
      is_unread: !markAsRead,
    };
  } else {
    itemToInsert = fetchedDiscussion!;
  }

  queryClient.setQueryData<DiscussionsInfinite>(listKey, (oldData) =>
    insertDiscussionAtTop(oldData, itemToInsert),
  );
}

// Insert a brand new discussion (known to be absent) at the top of the first page.
export async function insertNewDiscussion(opts: {
  queryClient: QueryClient;
  discussionId: number;
}) {
  const { queryClient, discussionId } = opts;

  const listKey = getDiscussionApiGetDiscussionsQueryKey();

  const discussion = await discussionApiGetDiscussion(discussionId);
  if (!discussion) {
    console.warn("Failed to fetch newly created discussion", discussionId);
    return;
  }

  queryClient.setQueryData<DiscussionsInfinite>(listKey, (oldData) =>
    insertDiscussionAtTop(oldData, discussion),
  );
}
