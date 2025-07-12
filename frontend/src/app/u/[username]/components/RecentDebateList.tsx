"use client";

import { DebateGrid } from "@/components/DebateGrid";
import { DebateCard } from "@/components/DebateCard";
import { AlertCircleIcon } from "lucide-react";
import { useDebateApiGetDebatesWithUserStance } from "@/lib/api/debate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RecentDebateListProps {
  userId: number;
}

const RecentDebateList = ({ userId }: RecentDebateListProps) => {
  const {
    data: userDebates,
    error,
    isPending,
  } = useDebateApiGetDebatesWithUserStance({
    user_id: userId,
  });

  if (isPending) {
    return null;
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
        <DebateCard key={debate.id} {...debate} />
      ))}
    </DebateGrid>
  );
};

export default RecentDebateList;
