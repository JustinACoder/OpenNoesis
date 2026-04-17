import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import DebateSection from "@/components/DebateSection";
import { ArrowLeft } from "lucide-react";
import { AppPagination } from "@/components/AppPagination";
import {
  DEBATE_BROWSE_PAGE_SIZE,
  debateBrowseFeeds,
  getDebateBrowseFeed,
  getDebateFeedPath,
  parsePositivePage,
} from "@/app/debates/browse-config";
import { canonicalPath, sanitizeTextForMeta } from "@/lib/seo";

type DebateFeedPageProps = {
  params: Promise<{ feed: string }>;
  searchParams: Promise<{ page?: string }>;
};

export function generateStaticParams() {
  return debateBrowseFeeds.map((feed) => ({ feed: feed.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: DebateFeedPageProps): Promise<Metadata> {
  const { feed } = await params;
  const { page } = await searchParams;
  const definition = getDebateBrowseFeed(feed);

  if (!definition) {
    return {};
  }

  const currentPage = parsePositivePage(page);
  const path = getDebateFeedPath(definition.slug, currentPage);
  const description = sanitizeTextForMeta(
    `${definition.longDescription} Page ${currentPage} of the ${definition.label.toLowerCase()} debate feed.`,
  );
  const pageLabel = currentPage > 1 ? ` Page ${currentPage}` : "";

  return {
    title: `${definition.homepageTitle}${pageLabel}`,
    description,
    alternates: {
      canonical: canonicalPath(path),
    },
    openGraph: {
      title: `${definition.homepageTitle}${pageLabel} | OpenNoesis`,
      description,
      url: canonicalPath(path),
    },
    twitter: {
      card: "summary_large_image",
      title: `${definition.homepageTitle}${pageLabel} | OpenNoesis`,
      description,
    },
  };
}

export default async function DebateFeedPage({
  params,
  searchParams,
}: DebateFeedPageProps) {
  const { feed } = await params;
  const { page } = await searchParams;
  const definition = getDebateBrowseFeed(feed);

  if (!definition) {
    notFound();
  }

  const currentPage = parsePositivePage(page);
  const results = await definition.loader(currentPage, DEBATE_BROWSE_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(results.count / DEBATE_BROWSE_PAGE_SIZE),
  );
  return (
    <NavigationOverlay>
      <div className="container mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/debates"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              All debate feeds
            </Link>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {definition.homepageTitle}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              {definition.longDescription}
            </p>
          </div>
          <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.count}</span>{" "}
            total debates
            {totalPages > 1 ? ` across ${totalPages} pages` : ""}
          </div>
        </section>

        <section className="mt-8">
          <DebateSection debates={results.items} />
        </section>

        <div className="mt-10 flex flex-col items-center gap-4">
          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            hrefConfig={{ basePath: getDebateFeedPath(definition.slug) }}
          />
        </div>
      </div>
    </NavigationOverlay>
  );
}
