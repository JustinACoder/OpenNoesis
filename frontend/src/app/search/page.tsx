import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import SearchClient from "@/app/search/components/SearchClient";
import { debateApiSearchDebates } from "@/lib/api/debate";
import { sanitizeTextForMeta } from "@/lib/seo";

interface SearchPageProps {
  searchParams: Promise<{ query?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { query, page } = await searchParams;
  const cleanQuery = (query || "").trim();
  const currentPage = Number.parseInt(page || "1", 10);
  const validPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;

  if (!cleanQuery) {
    return {
      title: "Search Debates",
      description: "Search debates and viewpoints on OpenNoesis.",
      alternates: {
        canonical: "/search",
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const description = sanitizeTextForMeta(
    `Search results for ${cleanQuery} on OpenNoesis.`,
  );
  const queryString = validPage > 1
    ? `/search?query=${encodeURIComponent(cleanQuery)}&page=${validPage}`
    : `/search?query=${encodeURIComponent(cleanQuery)}`;

  return {
    title: `Search: ${cleanQuery}`,
    description,
    alternates: {
      canonical: queryString,
    },
    openGraph: {
      title: `Search: ${cleanQuery} | OpenNoesis`,
      description,
      url: queryString,
    },
    twitter: {
      card: "summary",
      title: `Search: ${cleanQuery} | OpenNoesis`,
      description,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { query, page } = await searchParams;
  const cleanQuery = (query || "").trim();
  const currentPage = Number.parseInt(page || "1", 10);
  const validPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const initialResults = cleanQuery
    ? await debateApiSearchDebates({
        query: cleanQuery,
        page: validPage,
      }).catch(() => null)
    : null;

  return (
    <NavigationOverlay>
      <SearchClient
        query={cleanQuery}
        currentPage={validPage}
        initialResults={initialResults}
      />
    </NavigationOverlay>
  );
}
