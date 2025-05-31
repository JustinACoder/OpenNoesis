import {
  debateApiTrendingDebates,
  debateApiPopularDebates,
  debateApiControversialDebates,
  debateApiRecentDebates,
  debateApiRandomDebates,
} from "@/lib/api/debate";
import { DebateCard } from "@/components/DebateCard";
import { DebateGrid } from "@/components/DebateGrid";

export default async function HomePage() {
  // Parallel fetching to speed up SSR
  const [trending, popular, controversial, recent, random] = await Promise.all([
    debateApiTrendingDebates(),
    debateApiPopularDebates(),
    debateApiControversialDebates(),
    debateApiRecentDebates(),
    debateApiRandomDebates(),
  ]);

  const sections = [
    { title: "Trending Debates", items: trending.data.items },
    { title: "Popular Debates", items: popular.data.items },
    { title: "Controversial Debates", items: controversial.data.items },
    { title: "Recent Debates", items: recent.data.items },
    { title: "Other Debates", items: random.data.items },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8 space-y-12">
        {sections.map(({ title, items }) => (
          <section key={title}>
            <h2 className="text-2xl font-semibold mb-6">{title}</h2>
            <DebateGrid>
              {items.map((debate) => (
                <DebateCard key={debate.id} {...debate} />
              ))}
            </DebateGrid>
          </section>
        ))}
      </div>
    </main>
  );
}
