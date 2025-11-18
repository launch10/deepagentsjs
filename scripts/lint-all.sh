#!/bin/bash
# Run linters across the monorepo

set -e

cd "$(dirname "$0")/.."

echo "🔍 Running linters..."
echo ""

# Run Rails linter
echo "1️⃣  Running Rubocop..."
cd rails_app
if bundle exec rubocop; then
  echo "✅ Rubocop passed!"
else
  echo "❌ Rubocop failed!"
  exit 1
fi
echo ""

# Run Langgraph linter
echo "2️⃣  Running ESLint and TypeScript..."
cd ../langgraph_app
if pnpm run lint && pnpm run typecheck; then
  echo "✅ Langgraph linting passed!"
else
  echo "❌ Langgraph linting failed!"
  exit 1
fi
echo ""

echo "✅ All linting passed!"
