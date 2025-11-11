#!/bin/bash
# Generate TypeScript types from Rails models and sync to shared package

set -e

cd "$(dirname "$0")/.."

echo "🔄 Generating TypeScript types for Rails API..."
cd rails_app
pnpm run api:generate