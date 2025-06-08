import { DebateFullSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";

interface DebateContentProps {
  debate: DebateFullSchema;
}

export const JoinTheDebate = ({ debate }: DebateContentProps) => {
  return (
    <Box className="p-6" hover={false}>
      <h2 className="text-xl font-semibold text-white mb-4">Join the Debate</h2>
      <div className="flex justify-between items-center"></div>
    </Box>
  );
};
