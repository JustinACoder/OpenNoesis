from django.contrib import admin
from django.utils.html import format_html
from .models import Debate, Comment, Stance, GeneratedDebateCandidate
from .services import GeneratedDebateCandidateService


@admin.register(GeneratedDebateCandidate)
class GeneratedDebateCandidateAdmin(admin.ModelAdmin):
    list_display = [
        "debate",
        "status",
        "has_cover_image",
        "review_requested_at",
        "published_at",
    ]
    list_filter = ["status", "review_requested_at", "published_at"]
    search_fields = ["debate__title", "debate__description", "short_description"]
    readonly_fields = [
        "cover_image_preview",
        "cover_image_generated_at",
        "cover_image_generation_error",
        "discovered_at",
        "updated_at",
        "approved_at",
        "rejected_at",
        "published_at",
    ]
    actions = ["approve_candidates", "reject_candidates"]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "debate",
                    "status",
                )
            },
        ),
        (
            "Review",
            {
                "fields": (
                    "short_description",
                    "reviewer_notes",
                    "similarity_payload",
                    "source_payload",
                )
            },
        ),
        (
            "Cover Image",
            {
                "fields": (
                    "cover_image_preview",
                    "cover_image_reasoning",
                    "cover_image_generation_error",
                    "cover_image_generated_at",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "review_requested_at",
                    "approved_at",
                    "rejected_at",
                    "published_at",
                    "discovered_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(boolean=True, description="Cover")
    def has_cover_image(self, obj):
        return bool(obj.debate.image)

    @admin.display(description="Cover preview")
    def cover_image_preview(self, obj):
        if not obj.debate.image:
            return "No generated cover image."
        return format_html(
            '<img src="{}" alt="{}" style="max-width: 320px; border-radius: 12px;" />',
            obj.debate.image.url,
            obj.debate.title,
        )

    @admin.action(description="Approve and publish selected candidates")
    def approve_candidates(self, request, queryset):
        for candidate in queryset:
            GeneratedDebateCandidateService.approve_candidate(candidate)

    @admin.action(description="Mark selected candidates as rejected")
    def reject_candidates(self, request, queryset):
        for candidate in queryset:
            GeneratedDebateCandidateService.reject_candidate(candidate)

admin.site.register([Debate, Comment, Stance])
