import json
import traceback
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from tqdm import tqdm

from debate.oneoff.curated_debate_generation import (
    CURATED_EVERGREEN_DEBATE_TITLES,
    CuratedDebateGenerationError,
    CuratedDebateArtifact,
    iter_generated_curated_debate_artifacts,
    load_existing_and_pending_artifacts,
    merge_artifacts_for_output,
    save_artifacts_to_json,
)


class Command(BaseCommand):
    help = "Generate a reviewed JSON artifact for the hardcoded curated evergreen debates."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            required=True,
            help="Path where the generated JSON artifact should be written.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only generate the first N curated debates. Defaults to all hardcoded debates.",
        )
        parser.add_argument(
            "--skip-images",
            action="store_true",
            help="Generate descriptions only and skip contextual cover image generation.",
        )
        parser.add_argument(
            "--fresh",
            action="store_true",
            help="Ignore any existing output file and regenerate the requested titles from scratch.",
        )

    def handle(self, *args, **options):
        limit = max(0, options["limit"])
        titles = CURATED_EVERGREEN_DEBATE_TITLES[:limit] if limit else CURATED_EVERGREEN_DEBATE_TITLES
        output_path = Path(options["output"])

        if not titles:
            raise CommandError("No curated debate titles are available to generate.")

        try:
            existing_artifacts, titles_to_generate = load_existing_and_pending_artifacts(
                titles=titles,
                output_path=output_path,
                fresh=options["fresh"],
            )
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            raise CommandError(f"Failed to load existing artifact file: {output_path}") from exc
        skipped_count = len(titles) - len(titles_to_generate)

        new_artifacts: list[CuratedDebateArtifact] = []
        saved_output_path = output_path
        progress_bar = tqdm(
            total=len(titles),
            initial=skipped_count,
            desc="Generating curated debates",
            unit="debate",
            file=self.stdout,
        )
        try:
            for artifact in iter_generated_curated_debate_artifacts(
                titles=titles_to_generate,
                include_images=not options["skip_images"],
            ):
                new_artifacts.append(artifact)
                merged_artifacts = merge_artifacts_for_output(
                    existing_artifacts=existing_artifacts,
                    new_artifacts=new_artifacts,
                )
                saved_output_path = save_artifacts_to_json(
                    artifacts=merged_artifacts,
                    output_path=output_path,
                )
                progress_bar.set_postfix_str(artifact.title[:50], refresh=False)
                progress_bar.update(1)
        except CuratedDebateGenerationError as exc:
            traceback.print_exc(file=self.stderr)
            raise CommandError(str(exc)) from exc
        finally:
            progress_bar.close()

        self.stdout.write(self.style.SUCCESS(f"Generated {len(new_artifacts)} debate artifact(s)."))
        if skipped_count:
            self.stdout.write(f"Skipped {skipped_count} already-processed debate artifact(s) from existing output.")
        self.stdout.write(f"Output written to: {saved_output_path}")
