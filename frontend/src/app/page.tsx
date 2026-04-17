import type { Metadata } from "next";
import {
  debateApiTrendingDebates,
  debateApiPopularDebates,
  debateApiControversialDebates,
  debateApiRecentDebates,
  debateApiRandomDebates,
} from "@/lib/api/debate";
import { Suspense } from "react";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import DebateSection from "@/components/DebateSection";
import { ArrowRight, Loader2, SquarePen } from "lucide-react";
import Link from "next/link";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getDebateFeedPath } from "@/app/debates/browse-config";

export const metadata: Metadata = {
  title: "Explore Debates",
  description:
    "Discover trending, popular, and recent debates. Compare ideas and join the conversation on OpenNoesis.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Explore Debates | OpenNoesis",
    description:
      "Discover trending, popular, and recent debates. Compare ideas and join the conversation on OpenNoesis.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Debates | OpenNoesis",
    description:
      "Discover trending, popular, and recent debates. Compare ideas and join the conversation on OpenNoesis.",
  },
};

export default async function HomePage() {
  // Parallel fetching to speed up SSR
  const [trending, popular, controversial, recent, random, user] = await Promise.all([
    debateApiTrendingDebates({
      page_size: 6,
    }, {
      next: { revalidate: 60 },
    }),
    debateApiPopularDebates({
      page_size: 6,
    }, {
      next: { revalidate: 60 },
    }),
    debateApiControversialDebates({
      page_size: 6,
    }, {
      next: { revalidate: 60 },
    }),
    debateApiRecentDebates({
      page_size: 6,
    }, {
      next: { revalidate: 60 },
    }),
    debateApiRandomDebates({
      page_size: 6,
    }, {
      next: { revalidate: 60 },
    }),
    projectOpenDebateApiGetCurrentUserObject(),
  ]);

  const sections = [
    { title: "Trending Debates", slug: "trending", items: trending.items },
    { title: "Popular Debates", slug: "popular", items: popular.items },
    { title: "Controversial Debates", slug: "controversial", items: controversial.items },
    { title: "Recent Debates", slug: "recent", items: recent.items },
    { title: "Other Debates", slug: "other", items: random.items },
  ];

  return (
    <NavigationOverlay>
      <div className="container mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <section>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold">
                Start the next big debate
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Debating is the core of this platform. Post a clear question,
                explain both sides, and invite others to challenge ideas.
              </p>
            </div>
            <Button asChild size="lg">
              <Link
                href={
                  user.is_authenticated
                    ? "/debates/create"
                    : "/login?next=%2Fdebates%2Fcreate"
                }
                className="inline-flex items-center gap-2"
              >
                <SquarePen className="h-4 w-4" />
                Create Debate
              </Link>
            </Button>
          </div>
        </section>
        <Separator className="mt-8" />

        {/* The trending debates are rendered immediately for SEO */}
        <section className="pt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">{sections[0].title}</h2>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href={getDebateFeedPath(sections[0].slug)}>
                View more
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <DebateSection debates={sections[0].items} />
        </section>

        {sections.slice(1).map(({ title, slug, items }) => (
          <section key={title} className="mt-8 pt-2">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <Button asChild variant="ghost" className="shrink-0">
                <Link href={getDebateFeedPath(slug)}>
                  View more
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-32 w-100">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
            >
              <DebateSection debates={items} />
            </Suspense>
          </section>
        ))}
      </div>
    </NavigationOverlay>
  );
}
