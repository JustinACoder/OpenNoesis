from __future__ import annotations

from functools import wraps
from time import perf_counter

from prometheus_client import Counter, Histogram

API_OPERATION_TOTAL = Counter(
    "opennoesis_backend_operation_total",
    "Total number of backend API operations.",
    labelnames=("operation", "status"),
)

API_OPERATION_DURATION_SECONDS = Histogram(
    "opennoesis_backend_operation_duration_seconds",
    "Latency for backend API operations.",
    labelnames=("operation", "status"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

WS_EVENT_TOTAL = Counter(
    "opennoesis_backend_ws_event_total",
    "Total number of websocket events.",
    labelnames=("stream", "event", "status"),
)

WS_EVENT_DURATION_SECONDS = Histogram(
    "opennoesis_backend_ws_event_duration_seconds",
    "Latency for websocket event handling.",
    labelnames=("stream", "event", "status"),
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5),
)


def monitor_api_operation(operation: str):
    """Decorator for recording operation-level API success/error and latency metrics."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = perf_counter()
            status = "success"
            try:
                return func(*args, **kwargs)
            except Exception:
                status = "error"
                raise
            finally:
                duration = perf_counter() - start
                API_OPERATION_TOTAL.labels(operation=operation, status=status).inc()
                API_OPERATION_DURATION_SECONDS.labels(operation=operation, status=status).observe(duration)

        return wrapper

    return decorator


def observe_ws_event(stream: str, event: str, status: str, duration_seconds: float) -> None:
    """Records websocket event success/error and latency metrics."""
    WS_EVENT_TOTAL.labels(stream=stream, event=event, status=status).inc()
    WS_EVENT_DURATION_SECONDS.labels(stream=stream, event=event, status=status).observe(duration_seconds)
