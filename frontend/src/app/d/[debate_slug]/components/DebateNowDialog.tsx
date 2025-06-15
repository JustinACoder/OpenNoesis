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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Bell,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { DebateFullSchema } from "@/lib/models";

interface DebateNowDialogProps {
  debate: DebateFullSchema;
}

const DebateNowDialog = ({ debate }: DebateNowDialogProps) => {
  const userStance = debate.user_stance;
  const [opponentStance, setOpponentStance] = useState<1 | -1>(
    userStance === 1 ? -1 : 1, // Default to opposite of user's stance
  );
  const [searchType, setSearchType] = useState<"active" | "passive">("active");
  const [isOpen, setIsOpen] = useState(false);

  // Check if user has set their stance
  const hasStanceSet = userStance === 1 || userStance === -1;

  const handleStartSearch = () => {
    if (searchType === "active") {
      console.log(
        `Starting active search for opponent with stance: ${opponentStance === 1 ? "for" : "against"}`,
      );
      // TODO: Implement active search logic
    } else {
      console.log(
        `Starting passive search for opponent with stance: ${opponentStance === 1 ? "for" : "against"}`,
      );
      // TODO: Implement passive search logic
    }
    setIsOpen(false);
  };

  const handleOpponentStanceChange = (value: string) => {
    setOpponentStance(value === "for" ? 1 : -1);
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value as "active" | "passive");
  };

  const getUserStanceText = () => {
    if (userStance === 1) return "Support";
    if (userStance === -1) return "Oppose";
    return "Undecided";
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

        {!hasStanceSet ? (
          // Show warning if user hasn't set their stance
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                You need to set your stance on this debate before you can start
                debating with others. Please set your stance first.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Show current user stance */}
            <div className="">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>Your stance:</span>
                <div className="flex items-center space-x-1">
                  {userStance === 1 ? (
                    <ThumbsUp className="w-4 h-4 text-primary" />
                  ) : (
                    <ThumbsDown className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="font-medium">{getUserStanceText()}</span>
                </div>
              </div>
            </div>

            {/* Opponent stance selection */}
            <div className="">
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
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {hasStanceSet && (
            <Button onClick={handleStartSearch}>Start Search</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebateNowDialog;
