# Services & Port Allocation

All development services are managed through a unified infrastructure in `config/services.sh` and `bin/services`. Ports, databases, and Redis namespaces are auto-detected from the directory name, enabling up to 5 simultaneous instances (launch10 + launch1–4) with zero manual configuration.

## Architecture

```
config/services.sh (single source of truth)
       │
       ├─ Detects instance from directory name (launch10, launch1-4)
       ├─ Computes ports: base + (instance * 100)
       ├─ Sets database prefix: launch{N}_development / launch{N}_test
       ├─ Sets Redis DB: redis://localhost:6379/{N}
       └─ Exports all env vars
       │
       ▼
bin/services {command}
       │
       ├─ dev          → Overmind + Procfile.dev (rails + vite + langgraph)
       ├─ dev --full   → Overmind + Procfile.full (+ sidekiq + zhong + stripe)
       ├─ start        → Background daemons (PID files)
       ├─ stop         → Kill daemons
       ├─ status       → Check running processes
       ├─ cleanup      → Force kill all managed ports
       └─ env          → Display current config
```

## Port Allocation

| Instance | Dir | Rails (dev/test) | Langgraph (dev/test) | Vite (dev/test) | Redis DB |
|----------|-----|-------------------|----------------------|-----------------|----------|
| 10 | `launch10/` | 3000 / 3001 | 4000 / 4001 | 3036 / 3037 | 0 |
| 1 | `launch1/` | 3100 / 3101 | 4100 / 4101 | 3136 / 3137 | 1 |
| 2 | `launch2/` | 3200 / 3201 | 4200 / 4201 | 3236 / 3237 | 2 |
| 3 | `launch3/` | 3300 / 3301 | 4300 / 4301 | 3336 / 3337 | 3 |
| 4 | `launch4/` | 3400 / 3401 | 4400 / 4401 | 3436 / 3437 | 4 |

## Running Services

```bash
# Development mode (from rails_app/)
bin/dev                      # Core services
bin/dev --full               # All services (+ sidekiq, zhong, stripe)

# Test mode (for E2E)
bin/dev-test                 # Core services on test ports

# Background mode
bin/services start           # Daemon mode with PID files
bin/services stop            # Stop daemons

# Management
bin/services status          # What's running
bin/services cleanup         # Kill everything
bin/services env             # Show config
```

## Procfiles

| Procfile | Services | Used By |
|----------|----------|---------|
| `Procfile.dev` | web (Rails), vite, langgraph | `bin/dev`, `bin/dev-test` |
| `Procfile.full` | web, vite, langgraph, sidekiq, zhong, stripe, bullmq | `bin/dev --full` |
| `Procfile` | web, worker (sidekiq), zhong | Production |
| `Procfile.tunnel` | cloudflared tunnels + all services | `bin/tunnel` |

## Parallel Development Setup

```bash
# Clone the repo into a numbered directory
cd ~/programming/business
git clone <repo-url> launch3

# One-command setup (auto-detects instance)
cd launch3 && bin/setup-clone
```

`bin/setup-clone` performs three phases:
1. **Generate .env files** — Copies from `launch10/`, substitutes ports/databases/Redis
2. **Database setup** — Creates databases, runs Rails migrations, reflects Drizzle schema, seeds
3. **Install dependencies** — `bundle install` + `pnpm install`

Supports partial runs: `bin/setup-clone --env` (phase 1 only), `bin/setup-clone --db` (phases 2-3 only).

## Overmind Process Management

Overmind manages processes via tmux sessions with environment-specific sockets:

| Environment | Socket File |
|-------------|-------------|
| Development | `.overmind-dev.sock` |
| Test | `.overmind-test.sock` |

```bash
# Attach to Rails for binding.pry debugging
OVERMIND_SOCKET=.overmind-test.sock overmind connect web

# Detach: Ctrl+B then D
```

## Cloudflare Tunneling

`bin/tunnel` creates temporary public URLs for sharing dev builds:

1. Starts `cloudflared` tunnels for Rails + Langgraph
2. Captures `.trycloudflare.com` URLs
3. Injects tunnel URLs into `.env` files
4. Starts all services with tunnel URLs

## Key Files Index

| File | Purpose |
|------|---------|
| `config/services.sh` | Single source of truth for all config |
| `bin/services` | Unified service manager |
| `rails_app/bin/dev` | Development mode wrapper |
| `rails_app/bin/dev-test` | Test mode wrapper |
| `bin/setup-clone` | One-command clone setup |
| `bin/tunnel` | Cloudflare tunnel for sharing |
| `rails_app/Procfile.dev` | Core services (web + vite + langgraph) |
| `rails_app/Procfile.full` | Extended services (+ sidekiq + zhong + stripe + bullmq) |
| `rails_app/.overmind.env` | Overmind defaults |

## Gotchas

- **Directory name matters**: The instance number is extracted from the directory name (`launch3/` → instance 3). Renaming the directory changes all ports.
- **OVERMIND_SKIP_ENV=1**: `bin/services` prevents Overmind from auto-loading `.env` to avoid conflicts with Rails dotenv loading.
- **WSL socket paths**: On WSL, Overmind sockets go to `/tmp/` instead of the project directory to avoid Windows filesystem issues.
- **Health checks**: Background mode (`bin/services start`) polls `/up` (Rails) and `/health` (Langgraph) before declaring services ready.
- **`bin/setup-clone` is idempotent**: Safe to run multiple times. Creates databases only if they don't exist.
