# Background Jobs

Rails uses Sidekiq for background jobs with 9 weighted-priority queues and Zhong for cron scheduling. Langgraph uses BullMQ with Redis for async document processing. Both systems follow a batch coordinator + individual worker pattern for granular retries and observability.

## Architecture

```
Rails (Sidekiq + Zhong)                    Langgraph (BullMQ)
┌───────────────────────┐                  ┌──────────────────────┐
│ Sidekiq (65 workers)  │                  │ BullMQ (1 worker)    │
│ ├─ critical (wt: 10)  │                  │ └─ documentExtraction│
│ ├─ billing  (wt: 8)   │                  │    ├─ concurrency: 3 │
│ ├─ mailers  (wt: 5)   │                  │    ├─ attempts: 3    │
│ ├─ default  (wt: 2)   │                  │    └─ exp backoff    │
│ ├─ low      (wt: 1)   │                  └──────────────────────┘
│ └─ ...                 │
├────────────────────────┤
│ Zhong (13 cron jobs)   │
│ ├─ Every 30s: polls    │
│ ├─ Every 5m: monitors  │
│ ├─ Hourly: syncs       │
│ └─ Daily: maintenance  │
└────────────────────────┘
         │
         ▼
      Redis (isolated per instance)
```

## Sidekiq Queues

| Queue | Weight | Purpose | Example Workers |
|-------|--------|---------|-----------------|
| `critical` | 10 | Deploys, blocking, embeddings | DeployWorker, BlockWorker |
| `billing` | 8 | Payment, credits | ChargeRunWorker, ResetPlanCreditsWorker |
| `mailers` | 5 | Email delivery | SupportMailer |
| `active_storage_analysis` | 4 | File analysis | (Rails built-in) |
| `default` | 2 | General jobs | DnsVerificationWorker, EventWorker |
| `action_mailbox_routing` | 2 | Mail routing | (Rails built-in) |
| `active_storage_purge` | 1 | File cleanup | (Rails built-in) |
| `action_mailbox_incineration` | 1 | Mail cleanup | (Rails built-in) |
| `low` | 1 | Non-critical maintenance | PartitionMaintenanceWorker |

## Batch Coordinator Pattern

Collections are processed with a batch coordinator that enqueues individual workers:

```ruby
# Batch coordinator (enqueues per-item jobs)
class Domains::DnsVerificationBatchWorker < ApplicationWorker
  def perform
    Domain.pending_verification.find_each do |domain|
      Domains::VerifyDomainDnsWorker.perform_async(domain.id)
    end
  end
end

# Individual worker (retries independently)
class Domains::VerifyDomainDnsWorker < ApplicationWorker
  sidekiq_options retry: 3
  def perform(domain_id)
    domain = Domain.find(domain_id)
    Domains::DnsVerificationService.new(domain).verify!
  end
end
```

Used by: Google Ads sync, DNS verification, analytics computation, domain release.

## Zhong Schedule (Cron Jobs)

| Schedule | Job | Purpose |
|----------|-----|---------|
| Every 30s | `PollActiveInvitesWorker` | Poll Google Ads invite status |
| Every 5m | `MonitorDomainsWorker` | Check Cloudflare zone status |
| Every 30m | `GoogleDocs::IngestWorker` | Sync FAQs from Google Docs |
| Every 1h | `DnsVerificationBatchWorker` | Verify custom domain DNS |
| Every 1h | `SyncPerformanceWorker` | Google Ads metrics (7-day window) |
| Daily 01:00 | `PartitionMaintenanceWorker` | Create analytics partitions |
| Daily 02:00 | `PartitionCleanupWorker` | Clean old partitions |
| Daily 03:00 | `LocationTargeting::IngestWorker` | Google Ads geo targets |
| Daily 04:00 | `ReleaseStaleDomainWorker` | Release domains unverified 7+ days |
| Daily 05:00 | `ComputeDailyMetricsWorker` | Aggregate analytics from sources |
| Daily 12:01 EST | `DailyReconciliationWorker` | Yearly subscription credit resets |
| Every 1m | `FindUnprocessedRunsWorker` | Backup billing processor |

## Retry Strategies

**Linear backoff** (Tracking::EventWorker):
```ruby
sidekiq_retry_in { |count| [1, 5, 30, 120, 300][count] || 300 }
```

**Exponential backoff** (Cloudflare::BlockWorker):
```ruby
sidekiq_retry_in { |count| [60, 60, 300, 900, 1800][count-1] || 7200 }
```

**Kill after N attempts** (WebsiteDeploy::RollbackWorker):
```ruby
sidekiq_retry_in do |count|
  case count
  when 0 then 30
  when 1 then 120
  when 2 then 600
  else :kill
  end
end
```

## Exhaustion Handlers

Workers can define cleanup logic when all retries are exhausted:

```ruby
sidekiq_retries_exhausted do |msg, ex|
  deploy = WebsiteDeploy.find_by(id: msg["args"].first)
  deploy&.update!(status: "failed", stacktrace: ex.backtrace.join("\n"))
end
```

Used in: Deploy workers, rollback workers, campaign deploys.

## BullMQ (Langgraph)

Single queue for document extraction with 3 concurrent workers:

```typescript
// Queue configuration
{
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 24 * 3600, count: 100 },
  removeOnFail: { age: 7 * 24 * 3600 },
}
```

Redis connection uses `maxRetriesPerRequest: null` (required by BullMQ) and `noeviction` memory policy.

## Key Workers by Category

| Category | Workers | Queue |
|----------|---------|-------|
| Website Deploy | DeployWorker, RollbackWorker | critical |
| Campaign Deploy | DeployWorker (step-by-step) | critical |
| Cloudflare | MonitorDomains, Block, Unblock | critical |
| Credits/Billing | ChargeRun, FindUnprocessed, DailyReconciliation, AllocateGifts, ResetPlan | billing |
| Google Ads | SyncPerformance, PollInvites, SendInvite, IngestGeoTargets | default/analytics |
| Domains | DnsVerification, ReleaseStale, Release | default |
| Analytics | ComputeDailyMetrics, SyncPerformance | analytics/default |
| Support | SlackNotification, NotionCreation | default |
| Tracking | EventWorker | default |
| Database | PartitionMaintenance, PartitionCleanup | low |

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/config/sidekiq.yml` | Queue configuration with weights |
| `rails_app/config/initializers/sidekiq.rb` | Sidekiq initialization |
| `rails_app/app/workers/application_worker.rb` | Base worker class |
| `rails_app/schedule.rb` | Zhong cron schedule (13 jobs) |
| `rails_app/config/initializers/zhong.rb` | Zhong initialization |
| `rails_app/app/workers/` | 65 worker files across 14 categories |
| `langgraph_app/app/queues/documentExtraction.ts` | BullMQ queue definition |
| `langgraph_app/app/queues/connection.ts` | Redis connection for BullMQ |
| `langgraph_app/app/workers/documentExtractionWorker.ts` | Document extraction worker |

## Gotchas

- **Sidekiq inline for E2E**: `SIDEKIQ_INLINE=true` is set by `bin/dev-test` so jobs execute synchronously during Playwright tests.
- **Redis isolation per instance**: Each clone (launch1–4) uses a separate Redis DB, so Sidekiq queues and Zhong locks don't collide.
- **strict_args disabled**: `Sidekiq.strict_args!(false)` allows flexible argument serialization, but be careful with complex objects.
- **Zhong uses Redis locks**: Only one instance of each cron job runs at a time, even across multiple processes. This prevents duplicate execution.
- **BullMQ noeviction**: Redis memory policy is set to `noeviction` to prevent BullMQ data loss under memory pressure.
- **Job run tracking**: Workers that interact with Langgraph receive a `job_run_id` and notify Langgraph of completion via `job_run.notify_langgraph(status:)`.
