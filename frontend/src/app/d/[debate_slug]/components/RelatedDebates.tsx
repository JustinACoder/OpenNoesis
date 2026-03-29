import { DebateSchema } from "@/lib/models";
import { DebateCard } from "@/components/DebateCard";
import { Separator } from "@/components/ui/separator";

interface RelatedDebatesProps {
  debates: DebateSchema[];
}

export const RelatedDebates = ({ debates }: RelatedDebatesProps) => {
  return (
    <aside className="relative space-y-8 pt-6 lg:pl-8 xl:pl-10">
      <Separator className="lg:hidden" />
      <Separator
        orientation="vertical"
        className="absolute inset-y-0 left-0 hidden h-auto lg:block"
      />
      <h2 className="text-xl font-semibold text-foreground">Related Debates</h2>
      <div className="space-y-10">
        {debates.slice(0, 3).map((debate) => (
          <div key={debate.id}>
            <DebateCard {...debate} />
          </div>
        ))}
      </div>
    </aside>
  );
};
