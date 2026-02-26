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
import { Loader2 } from "lucide-react";

export default async function HomePage() {
  // Parallel fetching to speed up SSR
  const [trending, popular, controversial, recent, random] = await Promise.all([
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
