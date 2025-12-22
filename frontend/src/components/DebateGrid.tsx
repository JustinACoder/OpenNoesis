import React from "react";

type DebateGridProps = {
  children: React.ReactNode;
};

export function DebateGrid({ children }: DebateGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(325px,100%),1fr))] gap-6 items-stretch">
      {children}
    </div>
  );
}
