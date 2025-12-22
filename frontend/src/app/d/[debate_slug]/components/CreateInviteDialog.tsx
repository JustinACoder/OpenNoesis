"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, AlertTriangle, Copy, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { DebateFullSchema } from "@/lib/models";
import Link from "next/link";
import UserStanceInlineIndicator from "@/app/d/[debate_slug]/components/UserStanceInlineIndicator";
import { useDebatemeApiCreateInvite } from "@/lib/api/invites";

interface CreateInviteDialogProps {
  debate: DebateFullSchema;
}

const CreateInviteDialog = ({ debate }: CreateInviteDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createInvite } = useDebatemeApiCreateInvite();

  const userStance = debate.user_stance;
  const hasStanceSet = userStance === 1 || userStance === -1;

  const handleCreateInvite = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Call API to create an invite link
      const { code } = await createInvite({
        data: {
          debate_slug: debate.slug,
        },
      });

      if (!code) {
        throw new Error("Failed to create invite link");
      }

      // Mock invite link - replace with actual response
      const mockInviteLink = `${window.location.origin}/invite/${code}`;
      setInviteLink(mockInviteLink);

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(mockInviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      // Auto-select the text
      setTimeout(() => {
        linkInputRef.current?.select();
      }, 100);
    } catch (error) {
      console.error("Failed to create invite link:", error);
      setError("Failed to create invite link. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      linkInputRef.current?.select();
    } catch (err) {
      setError("Failed to copy link to clipboard. Please try again.");
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const resetDialog = () => {
    setInviteLink(null);
    setIsCopied(false);
    setError(null);
    setIsCreating(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          // Reset state when dialog closes
          setTimeout(resetDialog, 200);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          className="bg-blue-500 hover:bg-blue-600 text-white py-4 font-bold text-md w-full"
          size="lg"
          onClick={() => setIsOpen(true)}
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Invite to Debate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Someone to Debate</DialogTitle>
          <DialogDescription>
            Create a link to invite others to debate this topic with you.
          </DialogDescription>
        </DialogHeader>

        {!hasStanceSet ? (
          // Show warning if user hasn't set their stance
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You need to set your stance on this debate before you can invite
                others. Please set your stance first.
              </AlertDescription>
            </Alert>
          </div>
        ) : !inviteLink ? (
          // Show invite creation interface
          <div className="space-y-4">
            {/* Show current user stance */}
            <UserStanceInlineIndicator userStance={userStance} />

            <div className="text-sm text-muted-foreground">
              Others who join through your invite link will be able to take any
              stance and debate with you on this topic.
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCreateInvite}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Invite Link...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Invite Link
                </>
              )}
            </Button>
          </div>
        ) : (
          // Show created invite link
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-link" className="text-sm font-medium">
                Your invite link is ready!
              </Label>
              <div className="flex space-x-2">
                <Input
                  ref={linkInputRef}
                  id="invite-link"
                  value={inviteLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="px-3"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {isCopied && (
                <p className="text-xs text-green-600">
                  Link copied to clipboard!
                </p>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              Share this link with others to invite them to debate this topic
              with you. The link will remain active until you delete it.{" "}
              <Link
                href={"/my-invites"}
                target="_blank"
                className="text-primary hover:underline"
              >
                You can manage your invites here.
              </Link>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{inviteLink ? "Done" : "Cancel"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInviteDialog;
