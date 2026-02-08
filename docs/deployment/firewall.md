# Firewall & Rate Limiting

Launch10 enforces per-account monthly request limits at the Cloudflare edge. Every 5 minutes, Rails polls Cloudflare Analytics for domain-level traffic counts, aggregates them per account, and automatically blocks/unblocks accounts by creating WAF rules via the Cloudflare API. All enforcement happens at the edge — no latency impact on user requests.

## How It Works

```
Every 5 minutes (Zhong scheduler)
       │
       ▼
Domain.monitor_cloudflare_domains()
       │
       ▼
Cloudflare Analytics GraphQL API
  → hourly traffic per domain per zone
       │
       ▼
DomainRequestCount (hourly, partitioned by month)
       │
       ▼
AccountRequestCount (monthly aggregate)
       │
       ├─ over_limit? → BlockWorker → Cloudflare WAF rules
       └─ under_limit? → UnblockWorker → remove WAF rules
```

## Data Model

```
Account
  ├─ Plan → TierLimit (requests_per_month)
  ├─ Cloudflare::Firewall (status: inactive/blocked)
  │   └─ Cloudflare::FirewallRule (per-domain WAF rules)
  ├─ AccountRequestCount (monthly aggregate, partitioned)
  └─ DomainRequestCount (hourly per-domain, partitioned)
```

- **DomainRequestCount**: Hourly traffic per domain. Range-partitioned by month for query performance. Composite unique on `(account_id, domain_id, hour)`.
- **AccountRequestCount**: Monthly total per account. Aggregated from domain counts. Composite unique on `(account_id, month)`.
- Both tables use PostgreSQL range partitioning for efficient time-series queries.

## Plan Limits

| Plan | Monthly Requests |
|------|-----------------|
| Starter | 1,000,000 |
| Pro | 5,000,000 |
| Enterprise | 20,000,000 |

Limits stored in `TierLimit` model with `limit_type: "requests_per_month"`.

## Blocking Flow

1. `AccountRequestCount.update_accounts` detects account over limit
2. Enqueues `Cloudflare::BlockWorker` (critical queue, 5 retries, exponential backoff)
3. Worker calls `Cloudflare::Firewall.actually_block_account(account)`
4. Fetches all account's unblocked domains
5. `FirewallService.block_domains(domains)` creates WAF rules via Cloudflare API
6. `FirewallService.search_blocked_domains` retrieves Cloudflare rule IDs
7. Bulk upserts `FirewallRule` records with Cloudflare IDs
8. Updates `Firewall` status to `blocked`

**Unblocking** follows the inverse path when accounts are under their limit (e.g., after plan upgrade or month rollover).

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/cloudflare/firewall.rb` | Account-level firewall status |
| `rails_app/app/models/cloudflare/firewall_rule.rb` | Per-domain WAF rule tracking |
| `rails_app/app/services/cloudflare/firewall_service.rb` | Cloudflare WAF API client |
| `rails_app/app/models/domain_request_count.rb` | Hourly per-domain traffic (partitioned) |
| `rails_app/app/models/account_request_count.rb` | Monthly per-account aggregate |
| `rails_app/app/models/concerns/account_concerns/traffic_limits.rb` | `over_monthly_request_limit?` logic |
| `rails_app/app/models/cloudflare/monitorable.rb` | Domain monitoring orchestration |
| `rails_app/app/workers/cloudflare/block_worker.rb` | Blocking worker (critical, 5 retries) |
| `rails_app/app/workers/cloudflare/unblock_worker.rb` | Unblocking worker (critical, 5 retries) |
| `rails_app/app/workers/cloudflare/monitor_domains_worker.rb` | Batch monitoring orchestrator |
| `rails_app/app/services/cloudflare/analytics/queries/monitor_domains.rb` | Cloudflare Analytics GraphQL queries |
| `rails_app/app/models/tier_limit.rb` | Plan-based limits (requests_per_month) |
| `rails_app/schedule.rb` | Zhong scheduler (every 5 min) |

## Gotchas

- **No manual blocking**: Blocking is fully automated based on plan limits. There's no admin UI to manually block/unblock accounts.
- **5-minute polling window**: Traffic data has up to 5 minutes of lag. An account could briefly exceed its limit before blocking kicks in.
- **Exponential backoff on failures**: Block worker retries at 1m, 1m, 5m, 15m, 30m. Unblock retries at 1m, 5m, 15m, 1h, 2h. On exhaustion, admins are alerted for manual intervention.
- **Partition maintenance**: Daily jobs (01:00 and 02:00 UTC) create future partitions and clean up old ones. Without this, inserts fail when the current month's partition doesn't exist.
- **Edge enforcement only**: Rate limiting is enforced at the Cloudflare edge via WAF rules, not in the Rails or Langgraph application layer. This means zero latency impact on normal requests.
