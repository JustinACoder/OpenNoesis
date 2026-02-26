"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Calendar, Hash, User, Check, Copy } from "lucide-react";
import Link from "next/link";
import type { InviteSchema } from "@/lib/models";
import { useState } from "react";
import { useDebatemeApiDeleteInvite } from "@/lib/api/invites";
import { toast } from "sonner";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface InviteCardProps {
  showCreator?: boolean;
  invite: InviteSchema;
  onDelete?: () => void;
}

export function InviteCard({
  invite,
  showCreator = false,
  onDelete,
}: InviteCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const {
    mutateAsync: deleteInvite,
    isPending: isDeleting,
    isSuccess: isDeleted,
  } = useDebatemeApiDeleteInvite();

  if (!invite.code) {
    console.error(
      "InviteCard rendered without an invite code, this should not happen.",
    );
    return null; // Don't render anything if there's no invite code
  }

  const copyInviteUrl = () => {
    const inviteUrl = `${window.location.origin}/invite/${invite.code}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  };

  const deleteInviteHandler = async () => {
    if (isDeleting) return; // Prevent multiple deletions
    try {
      await deleteInvite({ inviteCode: invite.code! });
    } catch (error) {
      toast.error("Failed to delete invite. Please try again.");
      console.error("Error deleting invite:", error);
      return;
    }
    onDelete?.();
  };

  return (
    <Card
      className={`w-full hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500 ${isDeleting || isDeleted ? "opacity-50" : ""}`}
    >
      <CardContent className="p-3">
        {/* Header with title and actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link href={`/d/${invite.debate.slug}`} className="flex-1 group">
            <h3 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors duration-150 leading-tight text-sm">
              {invite.debate.title}
            </h3>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            {invite.code && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted"
                onClick={copyInviteUrl}
                title="Copy invite link"
                disabled={isDeleting || isDeleted}
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-muted"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={deleteInviteHandler}
                  disabled={isDeleting || isDeleted}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Metadata row - more compact layout */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {invite.code && (
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                {invite.code}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(invite.created_at)}</span>
          </div>

          {showCreator && invite.creator && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>@{invite.creator.username}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
