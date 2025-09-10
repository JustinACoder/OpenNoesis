from math import inf
from typing import List, Any, Optional, Literal
from datetime import datetime

from django.conf import settings
from django.urls import reverse_lazy
from django.db.models import Q
from ninja.pagination import PaginationBase
from ninja import Schema
from ninja.conf import settings as ninja_settings
from pydantic import Field


def reverse_lazy_api(view_name, **kwargs):
    """Helper function to get the full URL with the correct API namespace from settings"""
    namespaced_url = f"api-{settings.API_VERSION}:{view_name}"
    return reverse_lazy(namespaced_url, kwargs=kwargs)


def encode_cursor(ts: Optional[datetime], pk: int) -> str:
    """Encode cursor as either 'id' or 'ts|id'."""
    if ts is None:
        return str(pk)
    return f"{ts.isoformat()}|{pk}"


def decode_cursor(cursor: str) -> tuple[Optional[datetime], int]:
    """Decode cursor string into (ts, id)."""
    if "|" in cursor:
        ts_str, pk_str = cursor.split("|", 1)
        return datetime.fromisoformat(ts_str), int(pk_str)
    return None, int(cursor)


class CursorPagination(PaginationBase):
    def __init__(
        self,
        cursor_type: Literal["id", "date+id"] = "id",
        date_field: str = "created_at",
        ascending: bool = False,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)

        self.type = cursor_type
        self.date_field = date_field
        self.ascending = ascending

    class Input(Schema):
        cursor: Optional[str] = None  # id only OR "timestamp|id"
        limit: int = Field(
            ninja_settings.PAGINATION_PER_PAGE,
            ge=1,
            le=ninja_settings.PAGINATION_MAX_LIMIT
            if ninja_settings.PAGINATION_MAX_LIMIT != inf
            else None,
        )

    class Output(Schema):
        items: List[Any]
        next_cursor: Optional[str] = None
        current_cursor: Optional[str] = None
        count: int

    def paginate_queryset(self, queryset, pagination: Input, **params):
        cursor = pagination.cursor
        page_size = min(pagination.limit, ninja_settings.PAGINATION_MAX_LIMIT)

        total = self._items_count(queryset)

        # Choose ordering
        if self.type == "id":
            order_by = [f"{'' if self.ascending else '-'}id"]
        else:  # date+id
            order_by = [
                f"{'' if self.ascending else '-'}{self.date_field}",
                f"{'' if self.ascending else '-'}id",
            ]
        queryset = queryset.order_by(*order_by)

        # Apply cursor filter
        if cursor:
            ts, pk = decode_cursor(cursor)
            if self.type == "id":
                lookup = "gt" if self.ascending else "lt"
                queryset = queryset.filter(**{f"id__{lookup}": pk})
            else:  # date+id
                if self.ascending:
                    queryset = queryset.filter(
                        Q(**{f"{self.date_field}__gt": ts})
                        | Q(**{f"{self.date_field}": ts, "id__gt": pk})
                    )
                else:
                    queryset = queryset.filter(
                        Q(**{f"{self.date_field}__lt": ts})
                        | Q(**{f"{self.date_field}": ts, "id__lt": pk})
                    )

        items = list(queryset[: page_size + 1])

        has_next = len(items) > page_size
        if has_next:
            items = items[:page_size]

        next_cursor = None
        current_cursor = None

        if items and has_next:
            last = items[-1]
            if self.type == "id":
                next_cursor = encode_cursor(None, last.id)
            else:
                next_cursor = encode_cursor(getattr(last, self.date_field), last.id)

        if items:
            first = items[0]
            if self.type == "id":
                current_cursor = encode_cursor(None, first.id)
            else:
                current_cursor = encode_cursor(getattr(first, self.date_field), first.id)

        return {
            "items": items,
            "next_cursor": next_cursor,
            "current_cursor": current_cursor,
            "count": total,
        }
