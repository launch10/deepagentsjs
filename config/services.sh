#!/bin/bash
# config/services.sh - Single source of truth for all Launch10 service configuration
#
# Usage: source this file to get all service configuration
#   export LAUNCH10_ENV=test
#   source config/services.sh
#
# Environments:
#   development - Default, Rails on 3000, Langgraph on 4000
#   test        - Testing, Rails on 3001, Langgraph on 4001 (isolated from dev)
#   e2e         - Alias for test
#   ci          - Alias for test

set -a  # Auto-export all variables

# Determine project root (where this config lives)
LAUNCH10_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "${LAUNCH10_ENV:-development}" in
  test|e2e|ci)
    RAILS_PORT=3001
    LANGGRAPH_PORT=4001
    VITE_PORT=3037
    RAILS_ENV=test
    NODE_ENV=test
    USE_LOCAL_STORAGE=true  # Use local disk for uploads instead of R2
    ;;
  *)  # development
    RAILS_PORT=3000
    LANGGRAPH_PORT=4000
    VITE_PORT=3036
    RAILS_ENV=development
    NODE_ENV=development
    ;;
esac

# Derived URLs - computed from ports
# Only set VITE_* URLs for test environment (Playwright needs explicit URLs)
# In development, frontend uses default localhost:3000/4000
RAILS_API_URL="http://localhost:${RAILS_PORT}"
LANGGRAPH_API_URL="http://localhost:${LANGGRAPH_PORT}"

if [[ "${LAUNCH10_ENV:-development}" == "test" || "${LAUNCH10_ENV:-development}" == "e2e" || "${LAUNCH10_ENV:-development}" == "ci" ]]; then
  VITE_RAILS_API_URL="$RAILS_API_URL"
  VITE_LANGGRAPH_API_URL="$LANGGRAPH_API_URL"
fi

# All managed ports - used by cleanup scripts
MANAGED_PORTS="${RAILS_PORT} ${LANGGRAPH_PORT} ${VITE_PORT}"

# App directories
RAILS_APP_DIR="${LAUNCH10_ROOT}/rails_app"
LANGGRAPH_APP_DIR="${LAUNCH10_ROOT}/langgraph_app"

# Overmind socket - environment-specific to allow parallel runs
OVERMIND_SOCKET="${RAILS_APP_DIR}/.overmind-${LAUNCH10_ENV:-dev}.sock"

set +a  # Stop auto-exporting

# Debug output if requested
if [[ "${LAUNCH10_DEBUG:-}" == "true" ]]; then
  echo "=== Launch10 Service Config ==="
  echo "LAUNCH10_ENV:           ${LAUNCH10_ENV:-development}"
  echo "LAUNCH10_ROOT:          $LAUNCH10_ROOT"
  echo "RAILS_PORT:             $RAILS_PORT"
  echo "LANGGRAPH_PORT:         $LANGGRAPH_PORT"
  echo "RAILS_API_URL:          $RAILS_API_URL"
  echo "LANGGRAPH_API_URL:      $LANGGRAPH_API_URL"
  echo "VITE_RAILS_API_URL:     ${VITE_RAILS_API_URL:-(not set)}"
  echo "VITE_LANGGRAPH_API_URL: ${VITE_LANGGRAPH_API_URL:-(not set)}"
  echo "USE_LOCAL_STORAGE:      ${USE_LOCAL_STORAGE:-false}"
  echo "==============================="
fi
