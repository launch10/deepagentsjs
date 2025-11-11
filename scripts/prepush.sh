#!/bin/bash
# Pre-push hook to ensure documentation and types are up to date

set -e

cd "$(dirname "$0")/.."

echo "🚀 Running pre-push checks..."
echo ""

# Generate Swagger documentation
echo "1️⃣  Generating Swagger documentation..."
./scripts/generate-docs.sh
echo ""

# Generate and sync TypeScript types
echo "2️⃣  Generating TypeScript types..."
./scripts/generate-types.sh
echo ""

# Check if there are uncommitted changes to docs or types
if ! git diff --quiet rails_app/swagger/ shared/types/ 2>/dev/null; then
  echo "⚠️  Warning: Generated files have changes!"
  echo ""
  echo "The following files were updated:"
  git diff --name-only rails_app/swagger/ shared/types/ 2>/dev/null || true
  echo ""
  echo "Please review, commit, and push these changes."
  echo ""
  exit 1
fi

echo "✅ All pre-push checks passed!"
