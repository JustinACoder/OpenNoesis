#!/usr/bin/env sh

set -eu

PROM_DIR="${PROMETHEUS_MULTIPROC_DIR:-/tmp/django_prometheus_multiproc}"
mkdir -p "$PROM_DIR"
rm -f "$PROM_DIR"/*.db "$PROM_DIR"/*.tmp 2>/dev/null || true

exec "$@"
