import {
  debateApiGetDebate,
  debateApiGetDebateSuggestions,
  debateApiGetDebateComments,
} from "@/lib/api/debate";

import { DebateDetailHeader } from "./components/DebateDetailHeader";
import { JoinTheDebate } from "./components/JoinTheDebate";
import { DebateComments } from "./components/DebateComments";
import { RelatedDebates } from "./components/RelatedDebates";

interface DebateDetailPageProps {
  params: Promise<{ debate_slug: string }>;
}

const DebateDetailPage = async ({ params }: DebateDetailPageProps) => {
  const { debate_slug } = await params;
  // const queryClient = new QueryClient();

  const [debate, suggestions, comments] = await Promise.all([
    debateApiGetDebate(debate_slug),
    debateApiGetDebateSuggestions(debate_slug),
    debateApiGetDebateComments(debate_slug),
  ]);

  // Populate the cache with server data
  // This is necessary to ensure the data is available for optimistic updates (e.g., voting)
  // queryClient.setQueryData(getDebateApiGetDebateQueryKey(debate_slug), debate);

  return (
    //<HydrationBoundary state={dehydrate(queryClient)}>
    <main className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <DebateDetailHeader debate={debate} />
            <JoinTheDebate debate={debate} />
            <DebateComments
              comments={comments.items}
              debateSlug={debate_slug} // Pass slug for comment submission
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <RelatedDebates debates={suggestions.items} />
          </div>
        </div>
      </div>
    </main>
    //</HydrationBoundary>
  );
};
export default DebateDetailPage;
