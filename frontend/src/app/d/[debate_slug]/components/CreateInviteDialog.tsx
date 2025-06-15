"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

const CreateInviteDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="bg-blue-500 hover:bg-blue-600 text-white py-4 font-bold text-md w-full"
          size="lg"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Invite to Debate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Debate</DialogTitle>
        </DialogHeader>
        {/* Placeholder content - you can customize this */}
        <div className="py-4">
          <p className="text-muted-foreground">
            Content for inviting others will go here...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default CreateInviteDialog;
