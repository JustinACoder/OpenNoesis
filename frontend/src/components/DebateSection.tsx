import { DebateGrid } from "@/components/DebateGrid";
import { DebateCard } from "@/components/DebateCard";
import { DebateSchema } from "@/lib/models";

interface DebateSectionProps {
  debates: DebateSchema[];
}

const DebateSection = ({ debates }: DebateSectionProps) => {
  return (
    <DebateGrid>
      {debates.map((debate) => (
        <DebateCard key={debate.id} {...debate} />
      ))}
    </DebateGrid>
  );
};

export default DebateSection;
