import { Badge } from "@/components/ui/badge";
import React from "react";

interface BadgeCountProps {
  count: number;
  simpleSecondary?: boolean;
}

const BadgeCount = ({ count, simpleSecondary = false }: BadgeCountProps) => {
  if (simpleSecondary) {
    return <Badge variant="secondary">{count > 99 ? "99+" : count}</Badge>;
  }

  return (
    <Badge className="absolute top-1 right-3 h-4 min-w-4 flex items-center justify-center p-0 text-xs">
      {count > 99 ? "99+" : count}
    </Badge>
  );
};

export default BadgeCount;
