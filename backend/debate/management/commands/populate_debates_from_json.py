import json

from django.core.management.base import BaseCommand, CommandError

from debate.oneoff.curated_debate_generation import decode_artifact_image
from debate.models import Debate


class Command(BaseCommand):
    help = "Populate debates from a generated curated JSON artifact."

    def add_arguments(self, parser):
        parser.add_argument(
            "json_path",
            help="Path to the generated debate JSON artifact.",
        )

    def handle(self, *args, **options):
        json_path = options["json_path"]

        try:
            with open(json_path, encoding="utf-8") as file_handle:
                payload = json.load(file_handle)
        except FileNotFoundError as exc:
            raise CommandError(f"JSON file not found: {json_path}") from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON file: {json_path}") from exc

        if isinstance(payload, dict):
            debate_entries = payload.get("debates", [])
        elif isinstance(payload, list):
            debate_entries = payload
        else:
            raise CommandError("JSON payload must be a list or an object containing a 'debates' list.")

        created_count = 0
        skipped_count = 0

        for entry in debate_entries:
            title = (entry.get("title") or "").strip()
            description = (entry.get("description") or "").strip()

            if not title or not description:
                self.stdout.write(
                    self.style.WARNING("Skipping entry with missing title or description.")
                )
                skipped_count += 1
                continue

            if Debate.objects.filter(title__iexact=title).exists():
                skipped_count += 1
                self.stdout.write(f"Skipping existing debate: {title}")
                continue

            Debate.objects.create(
                title=title,
                description=description,
                author=None,
                image=decode_artifact_image(artifact=entry),
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} debate(s)."))
        self.stdout.write(f"Skipped {skipped_count} debate(s).")
