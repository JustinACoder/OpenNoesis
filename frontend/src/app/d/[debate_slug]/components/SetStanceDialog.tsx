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
import { Minus, ThumbsDown, ThumbsUp, LoaderCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useOptimisticMutation } from "@/lib/utils";
import { DebateFullSchema, StanceInputSchema } from "@/lib/models";
import {
  getDebateApiGetDebateQueryKey,
  useDebateApiSetStance,
} from "@/lib/api/debate";
import { useState } from "react";

interface SetStanceDialogProps {
  initialStance?: 1 | -1 | 0; // 1 for support, -1 for oppose, 0 for unset/neutral
  debateSlug: string; // Add debateSlug to identify the debate
}

const SetStanceDialog = ({
  initialStance = 0, // Default to unset if not provided
  debateSlug,
}: SetStanceDialogProps) => {
  const initialStanceString =
    initialStance === 1 ? "support" : initialStance === -1 ? "oppose" : "unset";
  const [selectedStance, setSelectedStance] = useState<1 | -1 | 0>(
    initialStance,
  );

  const { mutate: setStance, isPending } = useOptimisticMutation<
    DebateFullSchema,
    { debateSlug: string; data: StanceInputSchema }
  >(useDebateApiSetStance, {
    queryKey: getDebateApiGetDebateQueryKey(debateSlug),
    updateFn: (debate, variables) => {
      const newStance = variables.data.stance;
      const currentStance = debate.user_stance || 0;
      const previousNumFor = debate.num_for || 0;
      const previousNumAgainst = debate.num_against || 0;

      if (newStance === currentStance) {
        console.log(
          `No change in stance for debate ${debateSlug}: currentStance=${currentStance}, newStance=${newStance}`,
        );
        return debate; // No change needed
      }

      // Determine new counts based on the stance change
      let newNumFor = previousNumFor;
      let newNumAgainst = previousNumAgainst;

      if (currentStance === -1 && newStance === 1) {
        newNumFor++; // Increment for as we gain a new supporter
        newNumAgainst--; // Decrement against as they switch to support
      } else if (currentStance === 1 && newStance === -1) {
        newNumAgainst++; // Increment against as we gain a new opponent
        newNumFor--; // Decrement for as they switch to oppose
      } else if (currentStance === 1 && newStance === 0) {
        newNumFor--; // Decrement for as they switch to unset
      } else if (currentStance === -1 && newStance === 0) {
        newNumAgainst--; // Decrement against as they switch to unset
      } else if (currentStance === 0 && newStance === 1) {
        newNumFor++; // Increment for as they set stance to support
      } else if (currentStance === 0 && newStance === -1) {
        newNumAgainst++; // Increment against as they set stance to oppose
      } // all cases covered

      console.log(
        `Updating stance for debate ${debateSlug}: currentStance=${currentStance}, newStance=${newStance}, previousNumFor=${previousNumFor}, previousNumAgainst=${previousNumAgainst}, newNumFor=${newNumFor}, newNumAgainst=${newNumAgainst}`,
      );

      return {
        ...debate,
        user_stance: newStance,
        num_for: newNumFor,
        num_against: newNumAgainst,
      };
    },
    shouldInvalidate: true,
  });

  const handleStanceSave = () => {
    const stanceData: StanceInputSchema = {
      stance: selectedStance,
    };

    setStance({ debateSlug, data: stanceData });
  };

  const handleRadioChange = (value: string) => {
    if (value === "support") {
      setSelectedStance(1);
    } else if (value === "oppose") {
      setSelectedStance(-1);
    } else {
      setSelectedStance(0);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-white py-4 font-bold text-md w-full" size="lg">
          <ThumbsUp className="w-5 h-5 mr-2" />
          Set Your Stance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Your Stance</DialogTitle>
          <DialogDescription>
            Choose your position on the debate topic. You can change this at any
            time.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <RadioGroup
            defaultValue={initialStanceString}
            className="space-y-4"
            onValueChange={handleRadioChange}
          >
            {/* Support Option */}
            <Label
              htmlFor="support"
              className="flex items-center space-x-3 p-4 rounded-lg border border-muted hover:border-primary transition-colors cursor-pointer"
            >
              <RadioGroupItem
                value="support"
                id="support"
                className="data-[state=checked]:border-primary"
              />
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-primary/20">
                <ThumbsUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-medium">Support</div>
                <div className="text-sm text-muted-foreground">
                  I agree with this position
                </div>
              </div>
            </Label>

            {/* Oppose Option */}
            <Label
              htmlFor="oppose"
              className="flex items-center space-x-3 p-4 rounded-lg border border-muted hover:border-amber-500 transition-colors cursor-pointer"
            >
              <RadioGroupItem
                value="oppose"
                id="oppose"
                className="data-[state=checked]:border-amber-500"
              />
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-amber-500/20">
                <ThumbsDown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="font-medium">Oppose</div>
                <div className="text-sm text-muted-foreground">
                  I disagree with this position
                </div>
              </div>
            </Label>

            {/* Neutral/Unset Option */}
            <Label
              htmlFor="unset"
              className="flex items-center space-x-3 p-4 rounded-lg border border-muted hover:border-muted-foreground transition-colors cursor-pointer"
            >
              <RadioGroupItem
                value="unset"
                id="unset"
                className="data-[state=checked]:border-muted-foreground"
              />
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-muted-foreground/20">
                <Minus className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium">Undecided</div>
                <div className="text-sm text-muted-foreground">
                  I haven&#39;t made up my mind yet
                </div>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            className="bg-primary text-white hover:bg-primary/90"
            onClick={handleStanceSave}
            disabled={isPending}
            variant={isPending ? "outline" : "default"}
          >
            {isPending && (
              <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save Stance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetStanceDialog;
