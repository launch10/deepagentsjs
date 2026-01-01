#!/bin/bash
# langgraph_app/config/services.sh - Wrapper that sources root config
#
# This just sources the root config/services.sh for consistency.
# All configuration is centralized at the monorepo root.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/services.sh"
