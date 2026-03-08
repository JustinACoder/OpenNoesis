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
  ChevronLeft,
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
import { useDiscussionApiStartAiDiscussion } from "@/lib/api/discussions";
import { useAuthState } from "@/providers/authProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiBadge } from "@/components/AiBadge";
import { OPENNOESIS_AI_DISPLAY_NAME } from "@/lib/ai";
import styles from "./DebateNowDialog.module.css";

interface DebateNowDialogProps {
  debate: DebateFullSchema;
}

const DebateNowDialog = ({ debate }: DebateNowDialogProps) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const userStance = debate.user_stance || 0;
  const defaultOpponentStance =
    (userStance === 1 ? -1 : 1) as PairingRequestInputSchemaDesiredStance;
  const [opponentStanceOverride, setOpponentStanceOverride] =
    useState<PairingRequestInputSchemaDesiredStance | null>(null);
  const opponentStance =
    opponentStanceOverride ?? defaultOpponentStance;

  const [debateMode, setDebateMode] = useState<"human" | "ai">("human");
  const [searchType, setSearchType] =
    useState<PairingRequestInputSchemaPairingType>("active");
  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: startPairing, isPending: isPendingPairing } =
    usePairingApiRequestPairing();
  const { mutateAsync: startAiDiscussion, isPending: isPendingAiDiscussion } =
    useDiscussionApiStartAiDiscussion();
  const router = useRouter();
  const { authStatus } = useAuthState();

  const { data: currentActivePairingRequest } =
    usePairingApiGetCurrentActivePairing({
      query: {
        enabled:
          isOpen && authStatus === "authenticated" && debateMode === "human",
      },
    });

  const hasStanceSet = userStance === 1 || userStance === -1;
  const isPending = isPendingPairing || isPendingAiDiscussion;
  const totalSteps = debateMode === "human" ? 3 : 2;

  const handleStartDebate = async () => {
    try {
      if (debateMode === "ai") {
        const discussion = await startAiDiscussion({
          data: {
            debate_id: debate.id!,
            desired_stance: opponentStance,
          },
        });
        setIsOpen(false);
        router.push(`/chat/${discussion.id}`);
        return;
      }

      await startPairing({
        data: {
          debate_id: debate.id!,
          desired_stance: opponentStance,
          pairing_type: searchType,
        },
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Error starting debate:", error);
      toast.error("Failed to start debate. Please try again.");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setCurrentStep(1);
      setOpponentStanceOverride(null);
    }
  };

  const handleOpponentStanceChange = (value: string) => {
    const newStance =
      (value === "for" ? 1 : -1) as PairingRequestInputSchemaDesiredStance;
    setOpponentStanceOverride(newStance);
  };

  const handleSearchTypeChange = (
    value: PairingRequestInputSchemaPairingType,
  ) => {
    setSearchType(value);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (debateMode === "ai") {
        void handleStartDebate();
      } else {
        setCurrentStep(3);
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(2);
    }
  };

  const isActionDisabled =
    isPending ||
    (debateMode === "human" && !!currentActivePairingRequest) ||
    !hasStanceSet ||
    authStatus !== "authenticated";

  const actionLabel =
    currentStep < totalSteps
      ? "Next"
      : debateMode === "human"
        ? "Start Search"
        : "Start AI Debate";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full bg-amber-500 py-4 text-md font-bold text-white hover:bg-amber-600"
          size="lg"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Debate Now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Debate</DialogTitle>
          <DialogDescription>
            {currentStep === 1 && "Choose who you want to debate."}
            {currentStep === 2 && "Pick the stance you want to debate against."}
            {currentStep === 3 &&
              "Choose how you want to find a human opponent."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {authStatus === "unauthenticated" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>You must be logged in to start a debate.</AlertTitle>
              <AlertDescription>
                <p>
                  Please{" "}
                  <Link href="/login" className="text-primary underline">
                    log in
                  </Link>{" "}
                  or{" "}
                  <Link href="/signup" className="text-primary underline">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <UserStanceInlineIndicator userStance={userStance} />

          {currentStep === 1 && (
            <div>
              <div className="mb-3">
                <h4 className="text-sm font-medium">Who do you want to debate?</h4>
              </div>

              <RadioGroup
                value={debateMode}
                onValueChange={(value) => setDebateMode(value as "human" | "ai")}
              >
                <Label
                  htmlFor="human"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted p-4 transition-colors hover:border-primary"
                >
                  <RadioGroupItem value="human" id="human" />
                  <div>
                    <div className="text-sm font-medium">Another user</div>
                    <div className="text-xs text-muted-foreground">
                      Match with a real person via active or passive search
                    </div>
                  </div>
                </Label>

                <Label
                  htmlFor="ai"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted p-4 transition-colors hover:border-primary"
                >
                  <RadioGroupItem value="ai" id="ai" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{OPENNOESIS_AI_DISPLAY_NAME}</span>
                      <AiBadge />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Start instantly with an AI opponent in chat
                    </div>
                  </div>
                </Label>
              </RadioGroup>

              <div
                className={`${styles.premiumNotice} mt-3 flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs leading-snug`}
              >
                <span className="inline-flex shrink-0 items-center rounded-sm border border-amber-300/35 bg-amber-300/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  Limited-time
                </span>
                <span>All AI debate features are currently free with no usage limits.</span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <div className="mb-3">
                <h4 className="text-sm font-medium">Opponent stance:</h4>
                <p className="text-xs text-muted-foreground">
                  Choose the stance you want to debate against
                </p>
              </div>

              <RadioGroup
                value={opponentStance === 1 ? "for" : "against"}
                onValueChange={handleOpponentStanceChange}
              >
                <Label
                  htmlFor="for"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted p-3 transition-colors hover:border-primary"
                >
                  <RadioGroupItem
                    value="for"
                    id="for"
                    className="data-[state=checked]:border-primary"
                  />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20">
                    <ThumbsUp className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Supports this position</div>
                    <div className="text-xs text-muted-foreground">
                      Debate someone who agrees with the topic
                    </div>
                  </div>
                </Label>

                <Label
                  htmlFor="against"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted p-3 transition-colors hover:border-amber-500"
                >
                  <RadioGroupItem
                    value="against"
                    id="against"
                    className="data-[state=checked]:border-amber-500"
                  />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/20">
                    <ThumbsDown className="h-3 w-3 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Opposes this position</div>
                    <div className="text-xs text-muted-foreground">
                      Debate someone who disagrees with the topic
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          )}

          {currentStep === 3 && debateMode === "human" && (
            <div>
              <div className="mb-3">
                <h4 className="text-sm font-medium">
                  How would you like to find a match?
                </h4>
              </div>

              <RadioGroup value={searchType} onValueChange={handleSearchTypeChange}>
                <Label
                  htmlFor="active"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted bg-primary/5 p-4 transition-colors hover:border-primary hover:bg-primary/10"
                >
                  <RadioGroupItem
                    value="active"
                    id="active"
                    className="data-[state=checked]:border-primary"
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">Active Search</div>
                    <div className="text-xs text-muted-foreground">
                      Stay online for priority matching (faster results)
                    </div>
                  </div>
                </Label>

                <Label
                  htmlFor="passive"
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border border-muted p-4 transition-colors hover:border-muted-foreground hover:bg-muted/50"
                >
                  <RadioGroupItem
                    value="passive"
                    id="passive"
                    className="data-[state=checked]:border-muted-foreground"
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/20">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">Passive Search</div>
                    <div className="text-xs text-muted-foreground">
                      Get notified when a match is found (may take longer)
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          {currentStep > 1 && (
            <Button
              variant="ghost"
              onClick={handleBackStep}
              disabled={isPending}
              className="mr-auto"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}

          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button
            disabled={isActionDisabled}
            onClick={
              currentStep < totalSteps
                ? handleNextStep
                : () => void handleStartDebate()
            }
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebateNowDialog;
