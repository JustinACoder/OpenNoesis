from django.core.management.base import BaseCommand
from django.db.models import Count

from debate.models import Debate


class Command(BaseCommand):
    help = (
        "Delete debates that have no votes, stances, comments, discussions, invites, "
        "or pairing requests. Defaults to dry-run."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Actually delete the matching debates. Without this flag the command only reports them.",
        )

    def handle(self, *args, **options):
        debates = (
            Debate.objects.annotate(
                vote_count=Count("vote", distinct=True),
                stance_count=Count("stance", distinct=True),
                comment_count=Count("comment", distinct=True),
                discussion_count=Count("discussion", distinct=True),
                invite_count=Count("invite", distinct=True),
                pairing_request_count=Count("pairingrequest", distinct=True),
            )
            .filter(
                vote_count=0,
                stance_count=0,
                comment_count=0,
                discussion_count=0,
                invite_count=0,
                pairing_request_count=0,
            )
            .order_by("id")
        )

        debate_summaries = list(debates.values_list("id", "title"))
        if not debate_summaries:
            self.stdout.write(self.style.SUCCESS("No unused debates found."))
            return

        self.stdout.write(f"Found {len(debate_summaries)} unused debate(s):")
        for debate_id, title in debate_summaries:
            self.stdout.write(f"- {debate_id}: {title}")

        if not options["delete"]:
            self.stdout.write("Dry run only. Re-run with --delete to remove these debates.")
            return

        deleted_count, _details = debates.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {len(debate_summaries)} debate(s) ({deleted_count} row(s) removed)."))
