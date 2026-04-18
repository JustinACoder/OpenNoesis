"use client";

import Link from "next/link";
import { DebateSchema } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { SquarePen, Users } from "lucide-react";

interface MyDebateCardProps {
  debate: DebateSchema;
}

export function MyDebateCard({ debate }: MyDebateCardProps) {
  const stanceCount = (debate.num_for || 0) + (debate.num_against || 0);
  const formattedDate = new Date(debate.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="space-y-4 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-secondary sm:h-20 sm:w-32 sm:shrink-0">
          {debate.image_url ? (
            <ImageWithFallback
              src={debate.image_url}
              alt={debate.title}
              fill
              sizes="(max-width: 639px) 100vw, 128px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-card" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h2 className="line-clamp-2 text-lg font-semibold">{debate.title}</h2>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {debate.description_preview}
              </p>
            </div>
            <time
              dateTime={debate.date}
              className="shrink-0 text-sm text-muted-foreground"
            >
              {formattedDate}
            </time>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {stanceCount} stances
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href={`/d/${debate.slug}/edit`}>
                <SquarePen className="size-4" />
                Edit
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/d/${debate.slug}`}>View debate</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
