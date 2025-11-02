import {
  debateApiGetDebate,
  debateApiGetDebateSuggestions,
  getDebateApiGetDebateQueryKey,
  getDebateApiGetDebateSuggestionsQueryKey,
} from "@/lib/api/debate";

import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import DebateRootClient from "./components/DebateRootClient";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

interface DebateDetailPageProps {
  params: Promise<{ debate_slug: string }>;
}

const DebateDetailPage = async ({ params }: DebateDetailPageProps) => {
  const { debate_slug } = await params;
  const queryClient = new QueryClient();

  const [debate, suggestions] = await Promise.all([
    debateApiGetDebate(debate_slug),
    debateApiGetDebateSuggestions(debate_slug),
  ]);

  // Populate the cache with server data
  queryClient.setQueryData(getDebateApiGetDebateQueryKey(debate_slug), debate);
  queryClient.setQueryData(
    getDebateApiGetDebateSuggestionsQueryKey(debate_slug),
    suggestions,
  );

  return (
    <NavigationOverlay>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DebateRootClient debateSlug={debate_slug} />
      </HydrationBoundary>
    </NavigationOverlay>
  );
};
export default DebateDetailPage;
