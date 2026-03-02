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
import { Loader2, SquarePen } from "lucide-react";
import Link from "next/link";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  // Parallel fetching to speed up SSR
  const [trending, popular, controversial, recent, random, user] = await Promise.all([
    debateApiTrendingDebates(undefined, {
      next: { revalidate: 60 },
    }),
    debateApiPopularDebates(undefined, {
      next: { revalidate: 60 },
    }),
    debateApiControversialDebates(undefined, {
      next: { revalidate: 60 },
    }),
    debateApiRecentDebates(undefined, {
      next: { revalidate: 60 },
    }),
    debateApiRandomDebates(undefined, {
      next: { revalidate: 60 },
    }),
    projectOpenDebateApiGetCurrentUserObject(),
  ]);

  const sections = [
    { title: "Trending Debates", items: trending.items },
    { title: "Popular Debates", items: popular.items },
    { title: "Controversial Debates", items: controversial.items },
    { title: "Recent Debates", items: recent.items },
    { title: "Other Debates", items: random.items },
  ];

  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 space-y-12">
        <section className="rounded-2xl border bg-card p-6 md:p-8">
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

        {/* The trending debates are rendered immediately for SEO */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">{sections[0].title}</h2>
          <DebateSection debates={sections[0].items} />
        </section>

        {sections.slice(1).map(({ title, items }) => (
          <section key={title}>
            <h2 className="text-2xl font-semibold mb-6">{title}</h2>
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
