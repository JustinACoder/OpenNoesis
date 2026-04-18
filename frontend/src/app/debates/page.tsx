import type { Metadata } from "next";
import Link from "next/link";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { debateBrowseFeeds, getDebateFeedPath } from "@/app/debates/browse-config";

export const metadata: Metadata = {
  title: "Browse Debates",
  description:
    "Explore more debates across trending, popular, controversial, recent, and rotating feeds on OpenNoesis.",
  alternates: {
    canonical: "/debates",
  },
  openGraph: {
    title: "Browse Debates | OpenNoesis",
    description:
      "Explore more debates across trending, popular, controversial, recent, and rotating feeds on OpenNoesis.",
    url: "/debates",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse Debates | OpenNoesis",
    description:
      "Explore more debates across trending, popular, controversial, recent, and rotating feeds on OpenNoesis.",
  },
};

export default function DebatesPage() {
  return (
    <NavigationOverlay>
      <div className="container mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Browse more debates
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            The homepage highlights a small slice from each feed. Use these browse
            pages to keep exploring with deeper pagination and a larger page size.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {debateBrowseFeeds.map((feed) => (
            <Card key={feed.slug} className="rounded-3xl">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">{feed.homepageTitle}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  {feed.longDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {feed.shortDescription}
                </p>
                <Button asChild variant="outline" className="shrink-0">
                  <Link href={getDebateFeedPath(feed.slug)}>
                    View feed
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </NavigationOverlay>
  );
}
