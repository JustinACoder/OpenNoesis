import type { Metadata } from "next";
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
import { cache } from "react";
import { buildAbsoluteUrl, sanitizeTextForMeta } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isApiNotFoundError } from "@/lib/apiError";
import { markdownToPlainText } from "@/lib/markdown";

interface DebateDetailPageProps {
  params: Promise<{ debate_slug: string }>;
}

const getDebatePageData = cache(async (debateSlug: string) => {
  let debate: Awaited<ReturnType<typeof debateApiGetDebate>>;
  try {
    debate = await debateApiGetDebate(debateSlug);
  } catch (error) {
    if (isApiNotFoundError(error)) {
      notFound();
    }
    throw error;
  }

  const suggestions = await debateApiGetDebateSuggestions(debateSlug).catch(
    () => ({
      count: 0,
      items: [],
    }),
  );

  return { debate, suggestions };
});

export async function generateMetadata({
  params,
}: DebateDetailPageProps): Promise<Metadata> {
  const { debate_slug } = await params;
  const { debate } = await getDebatePageData(debate_slug);
  const canonicalPath = `/d/${debate.slug}`;
  const description = sanitizeTextForMeta(debate.description);

  return {
    title: "Debate: " + debate.title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      url: canonicalPath,
      title: debate.title,
      description,
      publishedTime: debate.date,
    },
    twitter: {
      card: "summary",
      title: debate.title,
      description,
    },
  };
}

const DebateDetailPage = async ({ params }: DebateDetailPageProps) => {
  const { debate_slug } = await params;
  const queryClient = new QueryClient();

  const { debate, suggestions } = await getDebatePageData(debate_slug);

  const debateUrl = buildAbsoluteUrl(`/d/${debate.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: debate.title,
    articleBody: markdownToPlainText(debate.description),
    datePublished: debate.date,
    dateModified: debate.date,
    mainEntityOfPage: debateUrl,
    url: debateUrl,
    author: debate.author?.username
      ? {
          "@type": "Person",
          name: debate.author.username,
        }
      : {
          "@type": "Organization",
          name: "OpenNoesis",
        },
  };

  // Populate the cache with server data
  queryClient.setQueryData(getDebateApiGetDebateQueryKey(debate_slug), debate);
  queryClient.setQueryData(
    getDebateApiGetDebateSuggestionsQueryKey(debate_slug),
    suggestions,
  );

  return (
    <NavigationOverlay>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DebateRootClient debateSlug={debate_slug} />
      </HydrationBoundary>
    </NavigationOverlay>
  );
};
export default DebateDetailPage;
