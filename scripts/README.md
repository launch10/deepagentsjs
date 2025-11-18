# Monorepo Scripts

This directory contains shared scripts for managing the Launch10 monorepo.

## Available Scripts

### Documentation & Types

- **`generate-docs.sh`** - Generate Swagger/OpenAPI documentation from Rails request specs
- **`generate-types.sh`** - Generate TypeScript types from Rails models and sync to shared package

### Quality Checks

- **`prepush.sh`** - Pre-push validation (runs before git push via Husky)
  - Generates Swagger docs
  - Generates and syncs TypeScript types
  - Fails if generated files have uncommitted changes

- **`lint-all.sh`** - Run all linters across the monorepo
  - Rubocop for Rails
  - ESLint and TypeScript for Langgraph

- **`test-all.sh`** - Run all tests across the monorepo
  - RSpec for Rails
  - Jest/Vitest for Langgraph

## Usage

From the monorepo root:

```bash
# Generate documentation
./scripts/generate-docs.sh

# Generate and sync types
./scripts/generate-types.sh

# Run all tests
./scripts/test-all.sh

# Run all linters
./scripts/lint-all.sh

# Run pre-push checks manually
./scripts/prepush.sh
```

## NPM Scripts

You can also use the npm scripts defined in the root `package.json`:

```bash
# Documentation
pnpm run docs:generate

# Types
pnpm run types:generate
pnpm run types:sync

# Testing
pnpm run test:all
pnpm run test:rails
pnpm run test:langgraph

# Linting
pnpm run lint:all
pnpm run lint:rails
pnpm run lint:langgraph

# Development
pnpm run dev:rails
pnpm run dev:langgraph
```

## Git Hooks

The prepush script is automatically run via Husky before every git push to ensure:
- Swagger documentation is up to date
- TypeScript types are up to date
- No uncommitted generated files

This prevents pushing code with outdated documentation or type definitions.
