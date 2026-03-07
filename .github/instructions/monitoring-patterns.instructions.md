---
applyTo: "backend/**/*.py,docker-compose*.yml,nginx.conf,monitoring/**/*.alloy"
---

# Monitoring Patterns

> **⚠️ Self-Updating Document**: If you learn—explicitly or implicitly—that any information in this document is outdated, incorrect, or incomplete, update this document immediately.

---

## Current Monitoring Topology

- Collector/agent: `alloy` service in `docker-compose.yml`
- Scrape target: backend `GET /api/metrics` (Django Prometheus export)
- Transport: `prometheus.remote_write` from Alloy to Grafana Cloud
- Grafana UI: Grafana Cloud (no local Grafana container)
- Metrics path in Nginx: `/api/metrics` is intentionally restricted to localhost only

Required env vars for Alloy:
- `GRAFANA_CLOUD_PROMETHEUS_URL`
- `GRAFANA_CLOUD_PROMETHEUS_USERNAME`
- `GRAFANA_CLOUD_PROMETHEUS_PASSWORD`

---

## What Agents Should Instrument

### 1) HTTP/API operation metrics (business-level)

Use `ProjectOpenDebate.common.metrics.monitor_api_operation` on important endpoint handlers.

- Metric names:
  - `opennoesis_backend_operation_total{operation,status}`
  - `opennoesis_backend_operation_duration_seconds{operation,status}`
- Status values: `success` or `error`
- Operation label examples:
  - `debate.create`
  - `invite.accept`
  - `pairing.request`

### 2) WebSocket event metrics

WebSocket event instrumentation is centralized in `ProjectOpenDebate/consumers.py` and records metrics for every handled event.

- Metric names:
  - `opennoesis_backend_ws_event_total{stream,event,status}`
  - `opennoesis_backend_ws_event_duration_seconds{stream,event,status}`
- Stream labels are defined by each consumer class (`stream_name`).

### 3) Framework-level metrics

`django-prometheus` also exports framework metrics (request counts/latency by status/view, DB/cache/process metrics). These are available on `/api/metrics` automatically.

---

## Labeling Rules (Mandatory)

> **🚨 SEVERE WARNING: HIGH-CARDINALITY LABELS CAN BREAK MONITORING**
> Never use dynamic identifiers as labels (`user_id`, `username`, `debate_slug`, `invite_code`, raw URL paths, timestamps, request IDs).
> Doing so can create massive numbers of time series, causing sharp RAM/CPU growth in collectors/backends, slow queries, and potentially service instability.
> If you need per-entity debugging, use logs/traces, not metric labels.

- Keep label cardinality low.
- Never add per-user/per-object IDs as labels (`user_id`, `debate_slug`, `invite_code`, etc.).
- Prefer stable dimensions only: `operation`, `status`, `stream`, `event`.

---

## Multiprocess Requirement (Daphne)

The backend runs multiple Daphne workers under Supervisor. Prometheus multiprocess mode is required.

- `PROMETHEUS_MULTIPROC_DIR` is the single source of truth for the multiprocess directory (set in env, with `/tmp/django_prometheus_multiproc` as default).
- Startup must clear stale multiprocess files before worker start.
- This is handled by `/app/scripts/run_with_prometheus_multiproc.sh` in the backend image.

If metrics look inflated after restart, verify multiprocess cleanup still runs.

---

## Query Patterns (PromQL)

Use these as baseline queries in Grafana Cloud:

- API success rate (5m):
  `sum(rate(opennoesis_backend_operation_total{status="success"}[5m])) by (operation)
   /
   sum(rate(opennoesis_backend_operation_total[5m])) by (operation)`

- API error rate (5m):
  `sum(rate(opennoesis_backend_operation_total{status="error"}[5m])) by (operation)`

- API p95 latency (5m):
  `histogram_quantile(0.95, sum(rate(opennoesis_backend_operation_duration_seconds_bucket[5m])) by (le, operation, status))`

- WS event throughput (5m):
  `sum(rate(opennoesis_backend_ws_event_total[5m])) by (stream, event, status)`

---

## Safe Extension Workflow

When adding a new feature that should be monitored:

1. Add/extend endpoint or websocket handler.
2. Add `monitor_api_operation("domain.action")` on write-critical API handlers.
3. For websocket handlers, ensure the consumer has a stable `stream_name`.
4. Run backend tests (`./test.sh` or targeted tests).
5. Validate metrics presence from inside backend container:
   `curl -s http://localhost:8000/api/metrics | grep opennoesis_backend_`
6. Validate ingestion in Grafana Cloud Explore with one of the metric names above.

