import { DebateSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";
import { DebateCard } from "@/components/DebateCard";

interface RelatedDebatesProps {
  debates: DebateSchema[];
}

export const RelatedDebates = ({ debates }: RelatedDebatesProps) => {
  return (
    <Box className="p-6 space-y-4" hover={false}>
      <h2 className="text-xl font-semibold text-white">Related Debates</h2>
      <div className="space-y-4">
        {debates.slice(0, 3).map((debate) => (
          <div key={debate.id}>
            <DebateCard {...debate} />
          </div>
        ))}
      </div>
    </Box>
  );
};
