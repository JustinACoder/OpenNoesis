import Link from "next/link";
import { ArrowUp, ArrowDown, Minus, User } from "lucide-react";
import { DebateSchema, type StanceDirectionEnum } from "@/lib/models";
import { ImageWithFallback } from "@/components/ImageWithFallback";

interface DebateCardProps extends DebateSchema {
  target_user_stance?: StanceDirectionEnum;
  target_user_name?: string; // Optional name for tooltip
}

export const DebateCard = (props: DebateCardProps) => {
  const {
    slug,
    title,
    description_preview,
    num_for = 0,
    num_against = 0,
    vote_score = 0,
    date,
    image_url,
    user_stance, // Current user's stance
    target_user_stance, // Target user's stance (for profile pages)
    target_user_name,
  } = props;

  const totalStances = num_for + num_against;
  const forPercent =
    totalStances > 0 ? Math.round((num_for / totalStances) * 100) : 50;
  const againstPercent = totalStances > 0 ? 100 - forPercent : 50;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Helper function to get stance text
  const getStanceText = (stance: StanceDirectionEnum) => {
    if (stance === 1) return "for";
    if (stance === -1) return "against";
    return "neutral";
  };

  const hasStanceSet = (stance?: StanceDirectionEnum) => {
    return stance === 1 || stance === -1;
  };

  return (
    <Link href={`/d/${slug}`} className="block group">
      <article
        className="relative flex h-full flex-col gap-3"
      >
        <div
          className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-border/60"
        >
          {image_url ? (
            <ImageWithFallback
              key={image_url}
              src={image_url}
              alt={title}
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              className="absolute inset-0 object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, color-mix(in oklab, white 10%, var(--card)) 0%, color-mix(in oklab, white 4%, var(--background)) 100%)",
              }}
            >
              <div className="absolute inset-0 opacity-70">
                <div className="absolute -left-10 top-0 h-24 w-24 rounded-full bg-white/8 blur-2xl" />
                <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-black/12 blur-2xl" />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/12 to-black/10" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88">
              Debate
            </span>
            <div className="flex items-center gap-2">
              {hasStanceSet(target_user_stance) && (
                <div
                  className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white/88"
                  title={
                    target_user_name
                      ? `${target_user_name} is ${getStanceText(target_user_stance)}`
                      : `User is ${getStanceText(target_user_stance)}`
                  }
                >
                  <User className="w-3 h-3" />
                  <span>{getStanceText(target_user_stance)}</span>
                </div>
              )}
              <div className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white/88">
                {vote_score > 0 ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : vote_score < 0 ? (
                  <ArrowDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>{vote_score}</span>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
            {hasStanceSet(user_stance) ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  user_stance === 1
                    ? "bg-primary/70 text-primary-foreground"
                    : "bg-destructive/70 text-white"
                }`}
              >
                You: {getStanceText(user_stance)}
              </span>
            ) : (
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white/88">
                No stance yet
              </span>
            )}
            <time
              dateTime={date}
              className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white/88"
            >
              {formattedDate}
            </time>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-1">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-lg font-semibold text-foreground text-ellipsis transition-colors group-hover:text-primary">
              {title}
            </h3>
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground text-ellipsis">
              {description_preview}
            </p>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{forPercent}% for</span>
              <span>{againstPercent}% against</span>
              <span>
                {totalStances} stance{totalStances === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-primary/90" style={{ width: `${forPercent}%` }} />
              <div
                className="bg-destructive/90"
                style={{ width: `${againstPercent}%` }}
              />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};
