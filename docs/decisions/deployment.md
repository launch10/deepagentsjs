# Deployment: Decision History

> Decisions about local development, staging, production deployment, and sharing environments. Most recent first.

---

## Current State

- **Production**: Not yet deployed
- **Local sharing**: Cloudflare quick tunnels via `bin/tunnel` script for demoing to stakeholders
- **Process management**: Foreman/Overmind with `Procfile.tunnel` manages all services + tunnels
- **Services**: Rails (3000), Vite (5173), Langgraph (8080) - all started together with tunnels

---

## Decision Log

### 2025-12-30: Cloudflare Tunnels for Local Demo Sharing

**Context:** Need to show the codebase to cofounder without deploying to production. Both Rails and Langgraph services need to communicate, and each has environment variables pointing to the other.

**Decision:** Create a `bin/tunnel` script that uses Cloudflare quick tunnels + Foreman/Overmind for process management:
1. Uses `Procfile.tunnel` to define all services (Rails, Vite, Langgraph) + tunnel processes
2. Leverages Foreman/Overmind for clean process management and output
3. Auto-detects tunnel URLs from cloudflared output
4. Backs up `.env` files, injects tunnel URLs, restores on cleanup

**Why:**
- Cloudflare quick tunnels are free and give unique URLs per tunnel (ngrok free shares one URL)
- Foreman/Overmind handles process lifecycle cleanly - one Ctrl+C stops everything
- No account/auth setup needed for cloudflared quick tunnels
- Reuses familiar tooling (already use Foreman for bin/dev)

**Implementation details:**
- `Procfile.tunnel` at project root runs: rails, vite, langgraph, tunnel_rails, tunnel_api
- `ALLOWED_ORIGINS` env var added to Langgraph for dynamic CORS
- URLs are `*.trycloudflare.com` - unique per tunnel, change each session
- macOS-specific `sed -i ''` syntax (would need adjustment for Linux)

**Trade-offs:**
- URLs change each session (no reserved domains without Cloudflare Zero Trust setup)
- Services start before tunnel URLs are known - may need restart to pick up URLs
- Requires cloudflared installed (`brew install cloudflared`)

**Alternatives considered:**
- ngrok: Free plan only provides one shared URL across tunnels - doesn't work for our use case
- Deploy to staging: More overhead, wanted something instant
- Tailscale/local network: Requires both parties on same network or VPN setup

**Status:** Current

---
