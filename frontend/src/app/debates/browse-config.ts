import {
  debateApiControversialDebates,
  debateApiPopularDebates,
  debateApiRandomDebates,
  debateApiRecentDebates,
  debateApiTrendingDebates,
} from "@/lib/api/debate";
import type { PagedDebateSchema } from "@/lib/models";

export const DEBATE_BROWSE_PAGE_SIZE = 24;

type DebateFeedLoader = (page: number, pageSize: number) => Promise<PagedDebateSchema>;

export type DebateBrowseFeedDefinition = {
  slug: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  homepageTitle: string;
  loader: DebateFeedLoader;
};

export const debateBrowseFeeds: DebateBrowseFeedDefinition[] = [
  {
    slug: "trending",
    label: "Trending",
    homepageTitle: "Trending Debates",
    shortDescription: "Fast-moving debates with the most current activity.",
    longDescription:
      "Browse the debates attracting the strongest recent momentum across OpenNoesis.",
    loader: (page, pageSize) =>
      debateApiTrendingDebates(
        { page, page_size: pageSize },
        { next: { revalidate: 60 } },
      ),
  },
  {
    slug: "popular",
    label: "Popular",
    homepageTitle: "Popular Debates",
    shortDescription: "Debates with the largest vote totals.",
    longDescription:
      "Browse the debates drawing the most overall voting activity on OpenNoesis.",
    loader: (page, pageSize) =>
      debateApiPopularDebates(
        { page, page_size: pageSize },
        { next: { revalidate: 60 } },
      ),
  },
  {
    slug: "controversial",
    label: "Controversial",
    homepageTitle: "Controversial Debates",
    shortDescription: "Close splits where both sides are heavily represented.",
    longDescription:
      "Browse the debates with the sharpest disagreement and the most balanced stance splits.",
    loader: (page, pageSize) =>
      debateApiControversialDebates(
        { page, page_size: pageSize },
        { next: { revalidate: 60 } },
      ),
  },
  {
    slug: "recent",
    label: "Recent",
    homepageTitle: "Recent Debates",
    shortDescription: "The newest debates posted to the platform.",
    longDescription:
      "Browse the latest debates added to OpenNoesis in chronological order.",
    loader: (page, pageSize) =>
      debateApiRecentDebates(
        { page, page_size: pageSize },
        { next: { revalidate: 60 } },
      ),
  },
  {
    slug: "other",
    label: "Other",
    homepageTitle: "Other Debates",
    shortDescription: "A rotating set of additional debates worth exploring.",
    longDescription:
      "Browse a wider rotating selection of debates beyond the main ranked feeds.",
    loader: (page, pageSize) =>
      debateApiRandomDebates(
        { page, page_size: pageSize },
        { next: { revalidate: 60 } },
      ),
  },
];

export function getDebateBrowseFeed(slug: string): DebateBrowseFeedDefinition | undefined {
  return debateBrowseFeeds.find((feed) => feed.slug === slug);
}

export function getDebateFeedPath(slug: string, page = 1): string {
  if (page <= 1) {
    return `/debates/${slug}`;
  }
  return `/debates/${slug}?page=${page}`;
}

export function parsePositivePage(value?: string): number {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
