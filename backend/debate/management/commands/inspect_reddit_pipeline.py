from django.core.management.base import BaseCommand, CommandError

from debate.reddit_retrieval import (
    DEFAULT_REDDIT_SUBREDDITS,
    build_reddit_shortlist,
    run_reddit_debate_seed_selection_pipeline,
)


class Command(BaseCommand):
    help = "Inspect the Reddit-first debate seed shortlist and comparative selection pipeline."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=5,
            help="Number of final LLM-selected candidates to print.",
        )
        parser.add_argument(
            "--per-subreddit-limit",
            type=int,
            default=25,
            help="How many posts to fetch per subreddit before heuristic pruning.",
        )
        parser.add_argument(
            "--per-subreddit-rank-limit",
            type=int,
            default=3,
            help="How many top heuristic posts to keep per subreddit before merging.",
        )
        parser.add_argument(
            "--shortlist-limit",
            type=int,
            default=20,
            help="Optional global cap for the heuristic shortlist sent to the LLM.",
        )
        parser.add_argument(
            "--listing",
            default="hot",
            choices=("hot", "new", "top"),
            help="Reddit listing type used for RSS discovery and JSON enrichment.",
        )
        parser.add_argument(
            "--subreddit",
            action="append",
            dest="subreddits",
            help=(
                "Subreddit to include. Repeat the flag for multiple values. "
                f"Defaults to: {', '.join(DEFAULT_REDDIT_SUBREDDITS)}"
            ),
        )
        parser.add_argument(
            "--shortlist-only",
            action="store_true",
            help="Only run heuristic retrieval and print the shortlist without the LLM stage.",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        per_subreddit_limit = options["per_subreddit_limit"]
        per_subreddit_rank_limit = options["per_subreddit_rank_limit"]
        shortlist_limit = options["shortlist_limit"]

        if limit <= 0:
            raise CommandError("--limit must be greater than 0")
        if per_subreddit_limit <= 0:
            raise CommandError("--per-subreddit-limit must be greater than 0")
        if per_subreddit_rank_limit <= 0:
            raise CommandError("--per-subreddit-rank-limit must be greater than 0")
        if shortlist_limit <= 0:
            raise CommandError("--shortlist-limit must be greater than 0")

        if options["shortlist_only"]:
            shortlist = build_reddit_shortlist(
                per_subreddit_limit=per_subreddit_limit,
                subreddits=options["subreddits"],
                per_subreddit_rank_limit=per_subreddit_rank_limit,
                listing=options["listing"],
                shortlist_limit=shortlist_limit,
            )
            self._print_shortlist(shortlist)
            return

        result = run_reddit_debate_seed_selection_pipeline(
            selection_limit=limit,
            per_subreddit_limit=per_subreddit_limit,
            subreddits=options["subreddits"],
            per_subreddit_rank_limit=per_subreddit_rank_limit,
            shortlist_limit=shortlist_limit,
            listing=options["listing"],
        )
        self._print_shortlist(result.shortlist)
        self.stdout.write("")
        self._print_selected(result.selected)

    def _print_shortlist(self, shortlist):
        if not shortlist:
            self.stdout.write("No Reddit shortlist items were returned.")
            return

        self.stdout.write(self.style.SUCCESS(f"Heuristic shortlist: {len(shortlist)} item(s)"))
        for item in shortlist:
            post = item.post
            self.stdout.write(
                f"{item.heuristic_rank}. {item.identifier} | r/{post.subreddit} | "
                f"heuristic_score={post.normalized_score:.3f} | subreddit_rank={item.subreddit_rank} | "
                f"title={post.title}"
            )
            self.stdout.write(
                "   "
                f"comments={post.comment_count if post.comment_count is not None else 'n/a'} | "
                f"upvote_ratio={_format_feature(post.upvote_ratio)} | "
                f"log_comments={_format_feature(post.raw_features.get('log_comment_count'))} | "
                f"norm_comments={_format_feature(post.normalized_features.get('normalized_comments'))} | "
                f"disagreement={_format_feature(post.raw_features.get('disagreement'))} | "
                f"norm_disagreement={_format_feature(post.normalized_features.get('normalized_disagreement'))}"
            )
            self.stdout.write(f"   url={post.url}")

    def _print_selected(self, selected):
        if not selected:
            self.stdout.write("No LLM-selected debate seeds were returned.")
            return

        self.stdout.write(self.style.SUCCESS(f"Final selection: {len(selected)} candidate(s)"))
        for item in selected:
            post = item.shortlist_item.post
            score = _format_feature(item.suitability_score)
            self.stdout.write(
                f"{item.rank}. r/{post.subreddit} | heuristic_score={post.normalized_score:.3f} | "
                f"suitability={score} | title={post.title}"
            )
            self.stdout.write(f"   suggested_debate_statement={item.suggested_debate_statement}")
            self.stdout.write(f"   reason={item.reason}")
            self.stdout.write(f"   url={post.url}")


def _format_feature(value):
    if value is None:
        return "n/a"
    return f"{value:.3f}"
