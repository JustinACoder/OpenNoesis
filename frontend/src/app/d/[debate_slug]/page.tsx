import {
  debateApiGetDebate,
  debateApiGetDebateSuggestions,
  debateApiGetDebateComments,
  getDebateApiGetDebateQueryKey,
  getDebateApiGetDebateCommentsQueryKey,
  getDebateApiGetDebateSuggestionsQueryKey,
} from "@/lib/api/debate";

import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import DebateRootClient from "./components/DebateRootClient";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

interface DebateDetailPageProps {
  params: Promise<{ debate_slug: string }>;
}

const DebateDetailPage = async ({ params }: DebateDetailPageProps) => {
  const { debate_slug } = await params;
  const queryClient = new QueryClient();

  const [debate, suggestions, comments] = await Promise.all([
    debateApiGetDebate(debate_slug),
    debateApiGetDebateSuggestions(debate_slug),
    debateApiGetDebateComments(debate_slug),
  ]);

  // Populate the cache with server data
  // This is necessary to ensure the data is available for optimistic updates (e.g., voting)
  queryClient.setQueryData(getDebateApiGetDebateQueryKey(debate_slug), debate);
  queryClient.setQueryData(
    getDebateApiGetDebateSuggestionsQueryKey(debate_slug),
    suggestions,
  );
  queryClient.setQueryData(
    getDebateApiGetDebateCommentsQueryKey(debate_slug),
    comments,
  );

  return (
    <>
      <Header />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DebateRootClient debateSlug={debate_slug} />
      </HydrationBoundary>
      <Footer />
    </>
  );
};
export default DebateDetailPage;
