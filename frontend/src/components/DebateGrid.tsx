import React from "react";

type DebateGridProps = {
  children: React.ReactNode;
};

export function DebateGrid({ children }: DebateGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-12 items-stretch md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}
