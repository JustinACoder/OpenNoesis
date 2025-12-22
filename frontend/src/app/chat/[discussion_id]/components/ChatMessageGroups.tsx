import React, { useMemo } from "react";
import {
  format,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isYesterday,
  Locale,
} from "date-fns";
import { enUS as defaultLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type MessageSchema = {
  text: string;
  id?: string | number | null;
  discussion: number;
  author: number;
  created_at: string;
};

type ChatMessageGroupsProps = {
  messages: MessageSchema[];
  currentUserId: number;
  /** Minutes between messages to consider same group. Default: 15 */
  gapMinutes?: number;
  /** date-fns locale (e.g., frCA) */
  locale?: Locale;
  /** Week start for isSameWeek. Default: 1 (Monday) */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Show per-message relative time under each bubble */
  showPerMessageTime?: boolean;
  className?: string;
};

function getGroupHeader(
  d: Date,
  opts: { now: Date; locale?: Locale; weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 },
) {
  const { now, locale = defaultLocale, weekStartsOn } = opts;

  if (isSameDay(d, now)) return format(d, "p", { locale }); // e.g., 3:05 PM
  if (isYesterday(d)) return `${format(d, "p", { locale })} · Yesterday`;
  if (isSameWeek(d, now, { weekStartsOn })) {
    // Monday · 3:05 PM
    return `${format(d, "EEEE", { locale })} · ${format(d, "p", { locale })}`;
  }
  if (isSameMonth(d, now)) {
    // Aug 12 · 3:05 PM
    return `${format(d, "MMM d", { locale })} · ${format(d, "p", { locale })}`;
  }
  // Aug 12, 2024 · 3:05 PM
  return `${format(d, "MMM d, yyyy", { locale })} · ${format(d, "p", { locale })}`;
}

type Group = {
  header: string;
  key: string;
  items: MessageSchema[];
};

function buildGroups(
  messages: MessageSchema[],
  options: {
    gapMinutes: number;
    locale?: Locale;
    weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  },
): Group[] {
  const sorted = [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const gapMs = options.gapMinutes * 60 * 1000;
  const groups: Group[] = [];

  let current: MessageSchema[] = [];
  let currentStart: Date | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
    const msgDate = new Date(msg.created_at);

    if (current.length === 0) {
      current.push(msg);
      currentStart = msgDate;
      continue;
    }

    const prevDate = new Date(current[current.length - 1].created_at);
    const diff = msgDate.getTime() - prevDate.getTime();

    if (diff <= gapMs) {
      current.push(msg);
    } else {
      const header = getGroupHeader(currentStart!, {
        now: new Date(),
        locale: options.locale,
        weekStartsOn: options.weekStartsOn,
      });
      groups.push({
        header,
        key: `${currentStart!.getTime()}-${current[0].id ?? i}`,
        items: current,
      });
      current = [msg];
      currentStart = msgDate;
    }
  }

  if (current.length) {
    const header = getGroupHeader(currentStart!, {
      now: new Date(),
      locale: options.locale,
      weekStartsOn: options.weekStartsOn,
    });
    groups.push({
      header,
      key: `${currentStart!.getTime()}-${current[0].id ?? "last"}`,
      items: current,
    });
  }

  return groups;
}

export const ChatMessageGroups: React.FC<ChatMessageGroupsProps> = ({
  messages,
  currentUserId,
  gapMinutes = 15,
  locale,
  weekStartsOn = 1,
  showPerMessageTime = false,
  className,
}) => {
  const groups = useMemo(
    () => buildGroups(messages, { gapMinutes, locale, weekStartsOn }),
    [messages, gapMinutes, locale, weekStartsOn],
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {groups.map((group) => (
        <div key={group.key} className="space-y-0.5">
          {/* Time header */}
          <div className="flex items-center justify-center my-2">
            <span className="text-gray-400 text-xs">{group.header}</span>
          </div>

          {/* Messages in this group */}
          {group.items.map((message, idx) => {
            const isOwnMessage = message.author === currentUserId;
            const isFollowedBySameGroupSameSide =
              group.items.length > idx + 1 &&
              group.items[idx + 1].author === message.author;
            const isPrecededBySameGroupSameSide =
              idx > 0 && group.items[idx - 1].author === message.author;
            return (
              <div
                key={
                  message.id ?? `${message.created_at}-${message.author}-${idx}`
                }
                className={cn(
                  "flex",
                  isOwnMessage ? "justify-end" : "justify-start",
                )}
              >
                <div className={cn("max-w-xs lg:max-w-md xl:max-w-lg")}>
                  <div
                    className={cn(
                      "px-4 py-3 rounded-3xl w-fit ml-auto",
                      isOwnMessage
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900",
                      isPrecededBySameGroupSameSide
                        ? isOwnMessage
                          ? "rounded-tr-sm"
                          : "rounded-tl-sm"
                        : "",
                      isFollowedBySameGroupSameSide
                        ? isOwnMessage
                          ? "rounded-br-sm"
                          : "rounded-bl-sm"
                        : "",
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                  </div>

                  {showPerMessageTime && (
                    <p
                      className={cn(
                        "text-xs text-gray-400 mt-1 px-1",
                        isOwnMessage ? "text-right" : "text-left",
                      )}
                    >
                      {format(new Date(message.created_at), "p", { locale })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
