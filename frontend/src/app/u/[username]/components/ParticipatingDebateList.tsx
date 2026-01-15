"use client";

import { DebateGrid } from "@/components/DebateGrid";
import { DebateCard } from "@/components/DebateCard";
import { AlertCircleIcon, LoaderCircle } from "lucide-react";
import { useDebateApiGetDebatesWithUserStance } from "@/lib/api/debate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PublicUserSchema } from "@/lib/models";

interface ParticipatingDebateListProps {
  user: PublicUserSchema;
}

const ParticipatingDebateList = ({ user }: ParticipatingDebateListProps) => {
  const {
    data: userDebates,
    error,
    isPending,
  } = useDebateApiGetDebatesWithUserStance({
    page: 1,
    user_id: user.id!, // Since the user should always be non-anonymous, we can assert that user.id is defined
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoaderCircle className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    console.error("Error loading user debates:", error);
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircleIcon />
        <AlertTitle>Error loading user debates</AlertTitle>
        <AlertDescription>
          An unexpected error occurred while fetching debates for this user.
          Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!userDebates || userDebates.count === 0) {
    return (
      <Alert>
        <AlertCircleIcon />
        <AlertTitle>No Debates Found</AlertTitle>
        <AlertDescription>
          This user has not set a stance on any debates yet. Check back later or
          encourage them to participate in discussions!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <DebateGrid>
      {userDebates.items.map((debate) => (
        <DebateCard
          key={debate.id}
          {...debate}
          target_user_stance={debate.target_user_stance}
          target_user_name={user.username}
        />
      ))}
    </DebateGrid>
  );
};

export default ParticipatingDebateList;
