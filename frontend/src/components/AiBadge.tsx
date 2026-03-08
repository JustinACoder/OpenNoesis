import React from "react";
import { cn } from "@/lib/utils";

type AiBadgeProps = {
  className?: string;
};

export const AiBadge = ({ className }: AiBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300",
        className,
      )}
    >
      AI
    </span>
  );
};
