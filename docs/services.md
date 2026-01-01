# Service Management

All Launch10 services are managed through `bin/services` at the monorepo root.

## Quick Start

```bash
# Development (ports 3000/4000)
bin/services dev

# Test/E2E (ports 3001/4001)
LAUNCH10_ENV=test bin/services dev

# Full stack with workers
bin/services dev --full
```

## Commands

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `bin/services dev`        | Foreground: rails + vite + langgraph   |
| `bin/services dev --full` | Foreground: + sidekiq, zhong, stripe   |
| `bin/services start`      | Background: rails + langgraph (daemon) |
| `bin/services stop`       | Stop background services               |
| `bin/services cleanup`    | Force kill all managed ports           |
| `bin/services status`     | Show what's running                    |
| `bin/services env`        | Show current config                    |

## Environments

Set `LAUNCH10_ENV` to switch between configurations:

| Environment             | Rails Port | Langgraph Port | Use Case              |
| ----------------------- | ---------- | -------------- | --------------------- |
| `development` (default) | 3000       | 4000           | Normal development    |
| `test`                  | 3001       | 4001           | E2E tests, playwright |

## From Subdirectories

Wrapper scripts are provided for convenience:

```bash
# From rails_app/
bin/dev          # Same as: LAUNCH10_ENV=development bin/services dev
bin/dev-test     # Same as: LAUNCH10_ENV=test bin/services dev

# From langgraph_app/
bin/services dev # Calls root bin/services
bin/test         # Runs tests with auto Rails management
```

## Playwright / E2E Tests

```bash
# From rails_app/
pnpm test:e2e        # Runs cleanup, starts services, runs tests
pnpm test:e2e:ui     # Playwright UI mode
pnpm test:e2e:headed # Headed browser
```

Playwright automatically starts `bin/dev-test` via its `webServer` config.

## Attaching to Particular Services While Running Playwright

```bash
overmind connect -s .overmind-test.sock web
overmind connect -s .overmind-test.sock langgraph # etc
```

## Configuration

All ports and URLs flow from `config/services.sh`:

```bash
# config/services.sh sets these based on LAUNCH10_ENV:
RAILS_PORT=3000|3001
LANGGRAPH_PORT=4000|4001
RAILS_API_URL=http://localhost:${RAILS_PORT}
LANGGRAPH_API_URL=http://localhost:${LANGGRAPH_PORT}
```

Procfiles read these env vars - never hardcode ports.

## Procfiles

| File            | Services                                     | Used By                   |
| --------------- | -------------------------------------------- | ------------------------- |
| `Procfile.dev`  | web, vite, langgraph                         | `bin/services dev`        |
| `Procfile.full` | web, vite, langgraph, sidekiq, zhong, stripe | `bin/services dev --full` |
| `Procfile`      | web, sidekiq, zhong                          | Production                |

## Troubleshooting

**Port already in use:**

```bash
bin/services cleanup
```

**Check what's running:**

```bash
bin/services status
```

**See current config:**

```bash
bin/services env
LAUNCH10_ENV=test bin/services env
```
