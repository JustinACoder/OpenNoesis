"use client";

interface StanceDistributionProps {
  numFor: number;
  numAgainst: number;
}

export const StanceDistribution = ({
  numFor,
  numAgainst,
}: StanceDistributionProps) => {
  const totalStances = numFor + numAgainst;
  const forPercent =
    totalStances > 0 ? Math.round((numFor / totalStances) * 100) : 50;
  const againstPercent = totalStances > 0 ? 100 - forPercent : 50;

  return (
    <div className="space-y-3">
      <div className="flex justify-between font-semibold text-sm">
        <span className="text-primary">{numFor} participants support</span>
        <span className="text-amber-500">{numAgainst} participants oppose</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className="bg-primary transition-all duration-300"
          style={{ width: `${forPercent}%` }}
        />
        <div
          className="bg-amber-500 transition-all duration-300"
          style={{ width: `${againstPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{forPercent}% for</span>
        <span>{againstPercent}% against</span>
      </div>
    </div>
  );
};
