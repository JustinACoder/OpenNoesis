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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Bell,
  AlertTriangle,
  Zap,
  Loader2,
} from "lucide-react";
import {
  DebateFullSchema,
  PairingRequestInputSchemaDesiredStance,
  PairingRequestInputSchemaPairingType,
} from "@/lib/models";
import UserStanceInlineIndicator from "@/app/d/[debate_slug]/components/UserStanceInlineIndicator";
import { toast } from "sonner";
import { useState } from "react";
import {
  usePairingApiGetCurrentActivePairing,
  usePairingApiRequestPairing,
} from "@/lib/api/pairing";
import { useAuth } from "@/providers/authProvider";
import Link from "next/link";

interface DebateNowDialogProps {
  debate: DebateFullSchema;
}

const DebateNowDialog = ({ debate }: DebateNowDialogProps) => {
  const userStance = debate.user_stance || 0;
  const [opponentStance, setOpponentStance] =
    useState<PairingRequestInputSchemaDesiredStance>(
      userStance === 1 ? -1 : 1, // Default to opposite of user's stance
    );
  const [searchType, setSearchType] =
    useState<PairingRequestInputSchemaPairingType>("active");
  const [isOpen, setIsOpen] = useState(false);
  const { mutateAsync: startPairing, isPending: isPendingPairing } =
    usePairingApiRequestPairing();
  const { authStatus } = useAuth();
  const { data: currentActivePairingRequest } =
    usePairingApiGetCurrentActivePairing({
      query: { enabled: isOpen && authStatus === "authenticated" },
    });

  // Check if user has set their stance
  const hasStanceSet = userStance === 1 || userStance === -1;

  const handleStartSearch = async () => {
    await startPairing({
      data: {
        debate_id: debate.id!,
        desired_stance: opponentStance,
        pairing_type: searchType,
      },
    })
      .then(() => {
        setIsOpen(false);
      })
      .catch((error) => {
        console.error("Error starting pairing:", error);
        toast.error("Failed to start search. Please try again.");
      });
  };

  const handleOpponentStanceChange = (value: string) => {
    setOpponentStance(value === "for" ? 1 : -1);
  };

  const handleSearchTypeChange = (
    value: PairingRequestInputSchemaPairingType,
  ) => {
    setSearchType(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white py-4 font-bold text-md w-full"
          size="lg"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Debate Now
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a Debate</DialogTitle>
          <DialogDescription>
            Find someone else to debate with you on this topic.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {authStatus === "unauthenticated" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>You must be logged in to start a debate.</AlertTitle>
              <AlertDescription>
                <p>
                  Please{" "}
                  <Link href="/login" className="underline text-primary">
                    log in
                  </Link>{" "}
                  or{" "}
                  <Link href="/signup" className="underline text-primary">
                    sign up
                  </Link>
                  .
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            authStatus === "authenticated" &&
            !hasStanceSet && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Your stance is not set.</AlertTitle>
                <AlertDescription>
                  You need to set your stance on this debate before you can find
                  an opponent to debate with.
                </AlertDescription>
              </Alert>
            )
          )}

          {/* Show current user stance */}
          <UserStanceInlineIndicator userStance={userStance} />

          {/* Opponent stance selection */}
          <div>
            <div className="mb-3">
              <h4 className="font-medium text-sm">Find an opponent who:</h4>
              <p className="text-xs text-muted-foreground">
                Choose the stance you want to debate against
              </p>
            </div>

            <RadioGroup
              defaultValue="against"
              onValueChange={handleOpponentStanceChange}
            >
              {/* Support Option */}
              <Label
                htmlFor="for"
                className="flex items-center space-x-3 p-3 rounded-lg border border-muted hover:border-primary transition-colors cursor-pointer"
              >
                <RadioGroupItem
                  value="for"
                  id="for"
                  className="data-[state=checked]:border-primary"
                />
                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-primary/20">
                  <ThumbsUp className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    Supports this position
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Debate someone who agrees with the topic
                  </div>
                </div>
              </Label>

              {/* Oppose Option */}
              <Label
                htmlFor="against"
                className="flex items-center space-x-3 p-3 rounded-lg border border-muted hover:border-amber-500 transition-colors cursor-pointer"
              >
                <RadioGroupItem
                  value="against"
                  id="against"
                  className="data-[state=checked]:border-amber-500"
                />
                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-amber-500/20">
                  <ThumbsDown className="w-3 h-3 text-amber-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    Opposes this position
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Debate someone who disagrees with the topic
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Search options */}
          <div>
            <div className="mb-3">
              <h4 className="font-medium text-sm">
                How would you like to find a match?
              </h4>
            </div>

            <RadioGroup
              defaultValue="active"
              onValueChange={handleSearchTypeChange}
            >
              {/* Active Search Option */}
              <Label
                htmlFor="active"
                className="flex items-center space-x-3 p-4 rounded-lg border border-muted hover:border-primary transition-colors cursor-pointer bg-primary/5 hover:bg-primary/10"
              >
                <RadioGroupItem
                  value="active"
                  id="active"
                  className="data-[state=checked]:border-primary"
                />
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Active Search</div>
                  <div className="text-xs text-muted-foreground">
                    Stay online for priority matching (faster results)
                  </div>
                </div>
              </Label>

              {/* Passive Search Option */}
              <Label
                htmlFor="passive"
                className="flex items-center space-x-3 p-4 rounded-lg border border-muted hover:border-muted-foreground transition-colors cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem
                  value="passive"
                  id="passive"
                  className="data-[state=checked]:border-muted-foreground"
                />
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-muted-foreground/20">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Passive Search</div>
                  <div className="text-xs text-muted-foreground">
                    Get notified when a match is found (may take longer)
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={
              isPendingPairing ||
              !!currentActivePairingRequest ||
              !hasStanceSet ||
              authStatus !== "authenticated"
            }
            onClick={handleStartSearch}
          >
            {isPendingPairing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Start Search"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebateNowDialog;
