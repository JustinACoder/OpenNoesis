from django.core.management.base import BaseCommand, CommandError

from debate.tasks.generate_candidates import run_generated_debate_pipeline


class Command(BaseCommand):
    help = "Run the generated debate discovery pipeline immediately."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-discord",
            action="store_true",
            help="Run the pipeline without sending Discord review notifications.",
        )
        parser.add_argument(
            "--min-candidates",
            type=int,
            default=0,
            help="Ask the generator to return at least this many candidates for testing.",
        )

    def handle(self, *args, **options):
        send_discord_notifications = not options["skip_discord"]
        minimum_candidates = max(0, options["min_candidates"])
        try:
            result = run_generated_debate_pipeline(
                send_discord_notifications=send_discord_notifications,
                minimum_candidates=minimum_candidates,
            )
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("Generated debate pipeline completed."))
        self.stdout.write(f"Candidates created or updated: {result.created_or_updated}")
        self.stdout.write(f"Duplicates skipped: {result.duplicates_skipped}")
        self.stdout.write(f"Invalid candidates skipped: {result.invalid_candidates_skipped}")
        self.stdout.write(f"Discord notifications sent: {result.discord_notifications_sent}")
