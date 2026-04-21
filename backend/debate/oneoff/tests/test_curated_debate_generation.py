import json
import tempfile
from dataclasses import asdict

from django.test import SimpleTestCase

from debate.oneoff.curated_debate_generation import (
    CuratedDebateArtifact,
    load_artifacts_from_json,
    load_existing_and_pending_artifacts,
    merge_artifacts_for_output,
    save_artifacts_to_json,
)


class CuratedDebateGenerationLogicTest(SimpleTestCase):
    def test_save_and_load_artifacts_round_trip(self):
        artifact = CuratedDebateArtifact(
            title="There is a God",
            description="Description 1",
            short_description="Short 1",
            source_links=["https://example.com/1"],
        )

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        save_artifacts_to_json(artifacts=[artifact], output_path=tmp_path)
        loaded_artifacts = load_artifacts_from_json(output_path=tmp_path)

        self.assertEqual(loaded_artifacts, [artifact])

    def test_load_existing_and_pending_artifacts_skips_existing_titles(self):
        existing_artifact = CuratedDebateArtifact(
            title="There is a God",
            description="Description 1",
            short_description="Short 1",
            source_links=["https://example.com/1"],
        )

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        with open(tmp_path, "w", encoding="utf-8") as existing_file:
            json.dump(
                {
                    "generated_by": "generate_curated_debates_json",
                    "debates": [asdict(existing_artifact)],
                },
                existing_file,
            )

        existing_artifacts, titles_to_generate = load_existing_and_pending_artifacts(
            titles=["There is a God", "Capitalism is immoral"],
            output_path=tmp_path,
        )

        self.assertEqual(existing_artifacts, [existing_artifact])
        self.assertEqual(titles_to_generate, ["Capitalism is immoral"])

    def test_load_existing_and_pending_artifacts_fresh_ignores_existing_output(self):
        existing_artifact = CuratedDebateArtifact(
            title="There is a God",
            description="Description 1",
            short_description="Short 1",
            source_links=["https://example.com/1"],
        )

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        with open(tmp_path, "w", encoding="utf-8") as existing_file:
            json.dump(
                {
                    "generated_by": "generate_curated_debates_json",
                    "debates": [asdict(existing_artifact)],
                },
                existing_file,
            )

        existing_artifacts, titles_to_generate = load_existing_and_pending_artifacts(
            titles=["There is a God"],
            output_path=tmp_path,
            fresh=True,
        )

        self.assertEqual(existing_artifacts, [])
        self.assertEqual(titles_to_generate, ["There is a God"])

    def test_load_existing_and_pending_artifacts_treats_empty_file_as_fresh(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        existing_artifacts, titles_to_generate = load_existing_and_pending_artifacts(
            titles=["There is a God"],
            output_path=tmp_path,
        )

        self.assertEqual(existing_artifacts, [])
        self.assertEqual(titles_to_generate, ["There is a God"])

    def test_merge_artifacts_for_output_preserves_existing_order_and_appends_new_titles(self):
        existing_artifact = CuratedDebateArtifact(
            title="There is a God",
            description="Description 1",
            short_description="Short 1",
            source_links=["https://example.com/1"],
        )
        replacement_artifact = CuratedDebateArtifact(
            title="There is a God",
            description="Updated description",
            short_description="Updated short",
            source_links=["https://example.com/updated"],
        )
        new_artifact = CuratedDebateArtifact(
            title="Capitalism is immoral",
            description="Description 2",
            short_description="Short 2",
            source_links=["https://example.com/2"],
        )

        merged_artifacts = merge_artifacts_for_output(
            existing_artifacts=[existing_artifact],
            new_artifacts=[replacement_artifact, new_artifact],
        )

        self.assertEqual(
            [artifact.title for artifact in merged_artifacts],
            ["There is a God", "Capitalism is immoral"],
        )
        self.assertEqual(merged_artifacts[0], replacement_artifact)
