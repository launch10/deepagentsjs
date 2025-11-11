#!/bin/bash
# Run all tests across the monorepo

set -e

cd "$(dirname "$0")/.."

echo "🧪 Running all tests..."
echo ""

# Run Rails tests
echo "1️⃣  Running Rails tests..."
cd rails_app
if bundle exec rspec; then
  echo "✅ Rails tests passed!"
else
  echo "❌ Rails tests failed!"
  exit 1
fi
echo ""

# Run Langgraph tests
echo "2️⃣  Running Langgraph tests..."
cd ../langgraph_app
if pnpm run test; then
  echo "✅ Langgraph tests passed!"
else
  echo "❌ Langgraph tests failed!"
  exit 1
fi
echo ""

echo "✅ All tests passed!"
