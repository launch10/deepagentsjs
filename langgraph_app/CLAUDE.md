# Development Principles

## Overview

This project is a Langgraph Typescript application that implements a website builder for landing pages.

## Architecture

Langgraph is one half of the application. The other half is Ruby On Rails, which is responsible for the database, authentication, and other backend functionality.

## Core Tools

- LanggraphJS
- Langgraph Server
- Drizzle (database management)
- Zod (schema validation)
- Vitest (testing)
- Polly (test recording)
- Evalite (evals)

## Testing

### CRITICAL: Always use --no-file-parallelism

**When running tests, ALWAYS use `--no-file-parallelism`:**

```bash
# Correct - recordings work properly
pnpm test --no-file-parallelism

# Run specific test file
pnpm test tests/tests/graphs/website/website.test.ts --no-file-parallelism

# Run specific test by name
pnpm test tests/tests/graphs/website/website.test.ts --no-file-parallelism -t "test name"
```

**Why this matters:**

Polly.js uses a **global singleton** for HTTP recording/playback. The `setRecordingName()` method mutates global state:

```typescript
// From withPolly.ts - this is GLOBAL mutation
server.any().recordingName(nodeName);
```

With parallel test execution:

1. Test A runs → sets recording name to "website-builder"
2. Test B runs in parallel → sets recording name to "unknown-node-execution"
3. Test A's HTTP requests → recorded to WRONG location ("unknown-node-execution")

This causes:

- **Cache misses** - requests hit real APIs instead of cached recordings
- **Expensive API calls** - $6+ per test run instead of $0
- **Flaky tests** - results depend on execution order

The `--no-file-parallelism` flag ensures only one test file runs at a time, preventing the race condition.

### Test Commands

The vitest config already sets `fileParallelism: false` by default. Just run:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test path/to/test.ts

# Run with name filter
pnpm test path/to/test.ts -t "pattern"
```

**NEVER override parallelism:**

```bash
# DANGEROUS - causes race conditions and real API calls ($6+ per run)
pnpm test --fileParallelism=true  # NEVER DO THIS
```

## Database

The Langgraph application NEVER modifies the database schema. To get the most up-to-date schema, run the following command:

```bash
pnpm run db:reflect
```

This will update the `schema.ts` file, providing you with the most up-to-date schema.

## Types

There are 2 types in our application:

1. Zod schemas that have a 1:1 mapping with a database table. For instance, the
   `ProjectType`, `WebsiteType`, `ComponentType`, map to the `projects`, `websites`,
   and `components` tables, respectively. Database types always extend the
   `baseModelSchema`, which provides primary key and timestamps for all models.

2. Zod schemas that are used for simple AI input/output. For instance, the
   `pagePlanPromptSchema` is used to generate a minimal number of fields for a
   set of page components. A `promptSchema` does not have foreign keys, primary
   keys, or other database-specific features.

We always follow these naming conventions:

1. A Zod schema is named `tableSchema`.
2. A Database type is named `TableType`.

We always utilize the core types such as `primaryKeySchema`, `railsDatetimeSchema`,
`uuidSchema`, and `baseModelSchema`, so that we can easily swap out all implementations
at once.

## Models

We implement a light ActiveRecord wrapper around Drizzle that connects zod schemas
with database tables. This is done in the `models` directory.

A model always extends the `BaseModel` class, which provides common functionality
for all models. It always maps to the properly named zod schema and database table.

## Imports

Our `tsconfig.json` always maps to an `index.ts` file in the directory, so we can
import from a directory without having to specify the file name.

```json
    "paths": {
      "@app": ["./app/index.ts"],
      "@annotation": ["./app/annotation/index.ts"],
      "@prompts": ["./app/prompts/index.ts"],
```

For instance, we can import a service as follows. We always import from the
root of the directory, in order to avoid loading multiple copies of the same
module.

```ts
import { PlanWebsiteService } from "@services";
```

## Organization

We always organize our code in the following way:

1. Models and drizzle talk to the database
2. Services implement business logic
3. Tools can wrap services, and provide a simple interface for models
   to call services.
4. Nodes can also wrap services, and provide a simple interface for Langgraph
   to call services.
5. Graphs implement the workflow
