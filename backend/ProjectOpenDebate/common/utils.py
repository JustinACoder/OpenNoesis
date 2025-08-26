from typing import List, Any, Optional, Union
from datetime import datetime

from django.conf import settings
from django.urls import reverse_lazy
from ninja.pagination import PaginationBase
from ninja import Schema


def reverse_lazy_api(view_name, **kwargs):
    """Helper function to get the full URL with the correct API namespace from settings"""
    namespaced_url = f"api-{settings.API_VERSION}:{view_name}"
    return reverse_lazy(namespaced_url, kwargs=kwargs)

class CursorPagination(PaginationBase):
    def __init__(self, cursor_field: str = 'id', page_size: int = 10, ascending: bool = False, **kwargs: Any):
        super().__init__(**kwargs)
        self.cursor_field = cursor_field
        self.page_size = page_size
        self.ascending = ascending
        self.filter_query_key = f"{cursor_field}__gt" if ascending else f"{cursor_field}__lt"
        self.sorting_direction = cursor_field if ascending else f"-{cursor_field}"

    class Input(Schema):
        cursor: Optional[Union[int, datetime]] = None

    class Output(Schema):
        items: List[Any]
        next_cursor: Optional[Union[int, datetime]] = None
        current_cursor: Optional[Union[int, datetime]] = None
        count: int

    def paginate_queryset(self, queryset, pagination: Input, **params):
        cursor = pagination.cursor

        # Get total count before applying filters
        total = self._items_count(queryset)

        queryset = queryset.order_by(self.sorting_direction)

        # If no cursor is provided, start from the beginning, therefore, no filter is applied
        if cursor is not None:
            queryset = queryset.filter(**{self.filter_query_key: cursor})

        # Get one more item than requested to determine if there are more pages
        items = list(queryset[:self.page_size + 1]) # force evaluation here

        has_next = len(items) > self.page_size
        if has_next:
            items = items[:self.page_size]

        # Generate cursors
        next_cursor = None
        prev_cursor = None

        if items and has_next:
            next_cursor = str(getattr(items[-1], self.cursor_field))

        if cursor and items:
            prev_cursor = str(getattr(items[0], self.cursor_field))

        return {
            'items': items,
            'next_cursor': next_cursor,
            'prev_cursor': prev_cursor,
            'count': total,
        }
