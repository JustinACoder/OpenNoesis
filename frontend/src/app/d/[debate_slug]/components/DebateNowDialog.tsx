"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const DebateNowDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white py-4 font-bold text-md w-full"
          size="lg"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Debate Now
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Debate Now</DialogTitle>
        </DialogHeader>
        {/* Placeholder content - you can customize this */}
        <div className="py-4">
          <p className="text-muted-foreground">
            Content for starting debate will go here...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DebateNowDialog;
