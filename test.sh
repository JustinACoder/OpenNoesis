#!/usr/bin/env bash

set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"
BASE_CMD=(docker compose -f "$COMPOSE_FILE" up --build --abort-on-container-exit --exit-code-from backend)

if [ "$#" -eq 0 ]; then
  echo "Running full backend test suite in Docker..."
  "${BASE_CMD[@]}"
  exit 0
fi

TEST_ARGS="$*"
echo "Running targeted backend tests in Docker: $TEST_ARGS"
TEST_ARGS="$TEST_ARGS" "${BASE_CMD[@]}"
