#!/bin/bash
# Generate WebContainer snapshot using Docker (Linux environment)
# This ensures platform-specific binaries match WebContainer's runtime

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAILS_APP_DIR="$(dirname "$SCRIPT_DIR")"

# Enable BuildKit for cache mounts (faster rebuilds)
export DOCKER_BUILDKIT=1

echo "Building Docker image for snapshot generation..."
# Force linux/amd64 platform - WebContainer runs x64 Linux regardless of host architecture
docker build --platform linux/amd64 -t webcontainer-snapshot -f "$SCRIPT_DIR/Dockerfile.snapshot" "$RAILS_APP_DIR"

echo "Running snapshot generation in Docker..."
# Use named volume for pnpm store persistence between runs
docker run --platform linux/amd64 --rm --memory=16g \
  -v "$RAILS_APP_DIR/public:/app/public" \
  -v webcontainer-pnpm-store:/root/.local/share/pnpm/store \
  webcontainer-snapshot

echo "Done! Snapshot saved to public/webcontainer-snapshot.bin"
ls -lh "$RAILS_APP_DIR/public/webcontainer-snapshot.bin"
