# AI Cost Reconciliation System

## Context

We're a bootstrapped startup where every AI dollar matters. Our billing pipeline (Langgraph captures tokens -> `llm_usage` table -> `ChargeRunWorker` -> `CreditTransaction`) works, but we have no verification that it's working *correctly*. If a bug silently drops usage records, miscalculates costs, or fails to charge an account, we lose money without knowing. This system answers: **Is every cent of AI spend accounted for, and is every user paying what they should?**

### Provider Data Sources

| Provider | Aggregated API | Per-Request Logs | Our Primary Use |
|----------|---------------|------------------|-----------------|
| **Anthropic** | Admin API (`/v1/organizations/usage_report/messages`) - hourly/daily buckets by model. Requires Admin API key (`sk-ant-admin...`). | Console UI at `platform.claude.com/workspaces/default/logs` - no public API, but accessible via browser automation. | Claude models (main spend) |
| **Groq** | None | Console UI at `console.groq.com/dashboard/logs` - accessible via browser automation. | Fast inference |
| **OpenAI** | Has usage API | Console logs available | Embeddings only (no user charge) |
| **Cohere** | Limited | N/A | Rerank only (no user charge) |

**Approach**: Three-pronged verification:
1. **Internal self-audit** (catches 90% of risk, no external dependency)
2. **Anthropic Admin API** aggregate comparison (documented, reliable)
3. **Browser automation log scraping** for per-request reconciliation (Playwright, daily schedule)

---

## Architecture: 6-Layer Reconciliation

| Layer | What It Does | Depends On | Phase |
|-------|-------------|------------|-------|
| **1. Internal Self-Audit** | Verifies every record is processed, every run charged, costs correct | Internal data only | 1 |
| **2. Account Billing Audit** | Per-account: usage sum = transaction sum, balances consistent | Internal data only | 1 |
| **3. Alerting** | Rollbar critical/warning, optional Slack | Layer 1-2,4-5 results | 1 |
| **4. Provider Aggregate Ingestion** | Fetches Anthropic hourly aggregates via Admin API | Anthropic Admin API | 2 |
| **5. Provider Aggregate Comparison** | Compares our token totals vs Anthropic's by model/hour | Layer 4 data | 2 |
| **6. Per-Request Log Reconciliation** | Browser automation scrapes provider console logs, matches 1:1 against `llm_usage` records | Playwright + provider consoles | 3 |

Layers 1-5 scheduled hourly via Zhong. Layer 6 runs daily (less aggressive). All on `:billing` queue.

---

## Phase 1 (MVP): Internal Self-Audit + Account Audit

No external API dependency. Catches the most dangerous problems immediately.

### Migration 1: `create_reconciliation_runs`

```ruby
# db/migrate/XXXX_create_reconciliation_runs.rb
create_table :reconciliation_runs do |t|
  t.string   :run_type,     null: false  # "hourly", "daily", "manual"
  t.datetime :period_start,  null: false
  t.datetime :period_end,    null: false
  t.string   :status,        null: false, default: "pending"  # pending/running/completed/failed
  t.jsonb    :summary,       default: {}
  t.text     :error_message
  t.datetime :started_at
  t.datetime :completed_at
  t.timestamps
end
add_index :reconciliation_runs, [:run_type, :period_start], unique: true
add_index :reconciliation_runs, :status
```

### Migration 2: `create_reconciliation_discrepancies`

```ruby
# db/migrate/XXXX_create_reconciliation_discrepancies.rb
create_table :reconciliation_discrepancies do |t|
  t.references :reconciliation_run, null: false, foreign_key: true
  t.string  :check_type,  null: false  # unprocessed_usage, missing_transaction, cost_mismatch, balance_drift, provider_delta, zero_token_anomaly, account_billing_mismatch, duplicate_transaction
  t.string  :severity,    null: false, default: "warning"  # info/warning/critical
  t.string  :status,      null: false, default: "open"     # open/acknowledged/resolved/false_positive
  t.text    :description, null: false
  t.jsonb   :details,     default: {}
  t.bigint  :account_id   # nullable - some checks are system-wide
  t.string  :resolved_by
  t.text    :resolution_notes
  t.datetime :resolved_at
  t.timestamps
end
add_index :reconciliation_discrepancies, :check_type
add_index :reconciliation_discrepancies, [:status, :severity]
add_index :reconciliation_discrepancies, :account_id
```

### Models

**`app/models/reconciliation_run.rb`**
- `has_many :discrepancies` (class_name: `ReconciliationDiscrepancy`)
- Status lifecycle methods: `start!`, `complete!(summary)`, `fail!(message)`
- Scopes: `recent`, `with_discrepancies`, `failed_or_critical`

**`app/models/reconciliation_discrepancy.rb`**
- `belongs_to :reconciliation_run`, `belongs_to :account, optional: true`
- Workflow methods: `resolve!(resolved_by:, notes:)`, `acknowledge!`, `mark_false_positive!`
- Scopes: `open_issues`, `critical`, `for_account`

### Service: `Reconciliation::InternalAuditService`

**File**: `app/services/reconciliation/internal_audit_service.rb`

5 checks, each producing discrepancies:

| Check | What | Severity |
|-------|------|----------|
| `check_unprocessed_usage` | `llm_usage` records with `processed_at: nil` older than 5 min | warning (>10 records = critical) |
| `check_missing_transactions` | Runs with processed usage but no `credit_transaction` (match via `reference_type: "LLMRun"`, `reference_id: run_id`) | critical |
| `check_cost_accuracy` | Sample 100 records, re-run `Credits::CostCalculator`, compare vs stored `cost_millicredits` | warning (>1000mc delta = critical) |
| `check_zero_token_anomalies` | Records with all token counts = 0 but `cost_millicredits > 0` | warning |
| `check_duplicate_transactions` | `credit_transactions` grouped by `reference_id` where `reference_type = "LLMRun"` having count > 1 | critical |

### Service: `Reconciliation::AccountBillingAuditService`

**File**: `app/services/reconciliation/account_billing_audit_service.rb`

2 checks:

| Check | What | Severity |
|-------|------|----------|
| `check_account_usage_vs_transactions` | For each account: `SUM(llm_usage.cost_millicredits)` vs `ABS(SUM(credit_transactions.amount_millicredits))` where `reason: "ai_generation"` in the period. Allow rounding tolerance (1mc per transaction). | warning (>10,000mc = critical) |
| `check_balance_integrity` | `account.total_millicredits` == latest `credit_transaction.balance_after_millicredits`, and `plan + pack == total` | critical |

Uses `CreditTransaction.latest_for_account(account)` (existing method at `credit_transaction.rb:64`).

### Service: `Reconciliation::AlertService`

**File**: `app/services/reconciliation/alert_service.rb`

- Critical discrepancies -> `Rollbar.error` with full details
- >5 warnings -> `Rollbar.warning`
- Always log summary to Rails logger

### Workers

All use `sidekiq_options queue: :billing` (weight 8, existing queue).

**`app/workers/reconciliation/hourly_reconciliation_worker.rb`** (Coordinator)
- Runs hourly via Zhong. Reconciles period from 2 hours ago (accounts for processing lag).
- Creates `ReconciliationRun` record (idempotent: skips if completed run exists for period).
- Enqueues: `InternalAuditWorker` + `AccountBillingAuditWorker` immediately, `FinalizeRunWorker` after 1 minute delay.

**`app/workers/reconciliation/internal_audit_worker.rb`** (retry: 2)
- Calls `InternalAuditService`.

**`app/workers/reconciliation/account_billing_audit_worker.rb`** (retry: 2)
- Calls `AccountBillingAuditService`.

**`app/workers/reconciliation/finalize_run_worker.rb`** (retry: 2)
- Builds summary (total discrepancies, by type/severity, period usage totals).
- Calls `run.complete!(summary)`, then `AlertService.new(run).call`.
- On failure: `run.fail!(error_message)`.

### Zhong Schedule Addition

In `schedule.rb`, add to existing `category "Credits"` block:

```ruby
every(1.hour, "hourly billing reconciliation") do
  Reconciliation::HourlyReconciliationWorker.perform_async
end
```

---

## Phase 2: Anthropic Provider Comparison

### Migration 3: `create_provider_usage_snapshots`

```ruby
# db/migrate/XXXX_create_provider_usage_snapshots.rb
create_table :provider_usage_snapshots do |t|
  t.string   :provider,              null: false  # "anthropic"
  t.string   :model_id,              null: false  # Model as reported by provider
  t.datetime :period_start,          null: false
  t.datetime :period_end,            null: false
  t.string   :granularity,           null: false, default: "hourly"
  t.bigint   :input_tokens,          null: false, default: 0
  t.bigint   :output_tokens,         null: false, default: 0
  t.bigint   :cache_creation_tokens, null: false, default: 0
  t.bigint   :cache_read_tokens,     null: false, default: 0
  t.jsonb    :raw_response,          default: {}
  t.string   :idempotency_key,       null: false  # "anthropic:model:2026-02-16T14:00Z"
  t.timestamps
end
add_index :provider_usage_snapshots, [:provider, :model_id, :period_start],
          name: "idx_provider_snapshots_lookup"
add_index :provider_usage_snapshots, :idempotency_key, unique: true
```

### Client: `AnthropicAdminClient`

**File**: `app/clients/anthropic_admin_client.rb` (extends `ApplicationClient`)

```ruby
BASE_URI = "https://api.anthropic.com/v1/organizations"

def authorization_header
  { "x-api-key" => admin_api_key, "anthropic-version" => "2023-06-01" }
end

def usage_report(start_time:, end_time:, granularity: "1h")
  get("/usage_report/messages", query: {
    "starting_at" => start_time.utc.iso8601,
    "ending_at" => end_time.utc.iso8601,
    "bucket_width" => granularity,
    "group_by[]" => "model"
  })
end
```

**Credential**: Store in Rails credentials under `anthropic.admin_api_key`. Fallback to `ENV["ANTHROPIC_ADMIN_API_KEY"]`.

### Service: `Reconciliation::ProviderIngestionService`

**File**: `app/services/reconciliation/provider_ingestion_service.rb`

- Calls `AnthropicAdminClient#usage_report` for the period
- Handles pagination (`has_more` / `next_page`)
- Stores each model/bucket as a `ProviderUsageSnapshot` (idempotent via `find_or_create_by!` on `idempotency_key`)
- Maps Anthropic fields: `uncached_input_tokens` -> `input_tokens`, `cached_input_tokens` -> `cache_read_tokens`
- Groq: logs "no API available" and returns gracefully

### Service: `Reconciliation::ProviderComparisonService`

**File**: `app/services/reconciliation/provider_comparison_service.rb`

- Aggregates our `llm_usage` by `model_raw` for the period (WHERE `model_raw LIKE 'claude%'`)
- Aggregates `provider_usage_snapshots` by `model_id` for same period
- Compares each token type (input, output, cache_creation, cache_read)
- Thresholds: flag if delta > 1% AND delta > 1000 tokens (ignore tiny volumes)
- Severity: >5% delta = critical, 1-5% = warning

**Model name matching**: Anthropic API may return model names that differ from our `model_raw`. Use `Credits::ModelNormalizer` logic to group both sides by normalized model key before comparing.

### Additional Workers

**`app/workers/reconciliation/provider_ingestion_worker.rb`** (retry: 3)
- Calls `ProviderIngestionService` for each provider (anthropic, groq).

**`app/workers/reconciliation/provider_comparison_worker.rb`** (retry: 2)
- Calls `ProviderComparisonService`.

### Updated Coordinator

`HourlyReconciliationWorker` updated to also enqueue:
- `ProviderIngestionWorker` immediately
- `ProviderComparisonWorker` after 2-minute delay (gives ingestion time to complete)

---

## Phase 3: Per-Request Log Reconciliation (Browser Automation)

The deepest level of verification: scrape per-request logs from provider consoles via Playwright, store each request, and match 1:1 against our `llm_usage` records.

### Migration 4: `create_provider_request_logs`

```ruby
# db/migrate/XXXX_create_provider_request_logs.rb
create_table :provider_request_logs do |t|
  t.string   :provider,              null: false  # "anthropic", "groq"
  t.string   :provider_request_id    # Provider's own request ID if available
  t.string   :model,                 null: false  # Model name as shown in provider logs
  t.datetime :requested_at,          null: false  # Timestamp from provider log
  t.integer  :input_tokens,          default: 0
  t.integer  :output_tokens,         default: 0
  t.integer  :cache_creation_tokens, default: 0
  t.integer  :cache_read_tokens,     default: 0
  t.integer  :total_tokens,          default: 0
  t.decimal  :cost_usd, precision: 10, scale: 6  # Cost as reported by provider
  t.integer  :status_code            # HTTP status if available
  t.string   :api_key_hint           # Last 4 chars of API key if shown
  t.jsonb    :raw_data,              default: {}  # Full log entry for audit
  t.string   :verification_status,   null: false, default: "pending"
    # pending / matched / unmatched / anomaly
  t.bigint   :matched_llm_usage_id   # FK to llm_usage if matched
  t.bigint   :reconciliation_run_id  # FK to reconciliation run that verified this
  t.timestamps
end
add_index :provider_request_logs, [:provider, :requested_at]
add_index :provider_request_logs, :provider_request_id
add_index :provider_request_logs, :verification_status
add_index :provider_request_logs, :matched_llm_usage_id
add_index :provider_request_logs, :reconciliation_run_id
```

### Browser Automation Scripts

Playwright scripts live alongside our existing E2E test infrastructure. Each provider gets its own script.

**`scripts/reconciliation/scrape_anthropic_logs.ts`**
- Launches headless Chromium via Playwright
- Authenticates to `platform.claude.com` using stored session/cookie (or API key login)
- Navigates to `/workspaces/default/logs`
- Filters to the target time range (previous 24 hours)
- Extracts log entries (request ID, model, timestamp, token counts, cost, status)
- Outputs JSON array to stdout
- Falls back gracefully if UI structure changes (logs warning, returns partial data)

**`scripts/reconciliation/scrape_groq_logs.ts`**
- Same pattern for `console.groq.com/dashboard/logs`
- Authenticates via stored Groq session
- Extracts available fields

**Authentication**: Console credentials stored in Rails credentials:
```yaml
anthropic:
  admin_api_key: sk-ant-admin01-XXXX
  console_session_key: <session cookie or auth token>
groq:
  console_session_key: <session cookie or auth token>
```

Note: The exact authentication flow and log page structure need to be verified during implementation by inspecting the live pages. The scripts will be built iteratively - first manually verify what data is available, then automate.

### Service: `Reconciliation::LogScrapingService`

**File**: `app/services/reconciliation/log_scraping_service.rb`

```ruby
def call
  # 1. Run Playwright script via system command
  output = run_playwright_script(provider)
  # 2. Parse JSON output
  log_entries = JSON.parse(output)
  # 3. Upsert into provider_request_logs (idempotent on provider + provider_request_id)
  log_entries.each { |entry| upsert_log_entry(entry) }
end

private

def run_playwright_script(provider)
  script = Rails.root.join("scripts/reconciliation/scrape_#{provider}_logs.ts")
  # Run via npx playwright (already installed in project)
  stdout, stderr, status = Open3.capture3(
    "npx", "tsx", script.to_s,
    "--start", @period_start.iso8601,
    "--end", @period_end.iso8601
  )
  raise Error, "Script failed: #{stderr}" unless status.success?
  stdout
end
```

### Service: `Reconciliation::LogMatchingService`

**File**: `app/services/reconciliation/log_matching_service.rb`

Matches provider log entries against our `llm_usage` records:

```
For each unmatched provider_request_log:
  1. Find llm_usage candidates by: model match + timestamp within +-30 seconds
  2. Narrow by token count similarity (input_tokens within 5% tolerance)
  3. If exactly 1 match: mark as "matched", link via matched_llm_usage_id
  4. If 0 matches: mark as "unmatched" (we missed recording this request)
  5. If >1 matches: mark as "anomaly" (ambiguous, needs manual review)
```

Unmatched records become `provider_delta` discrepancies (critical if cost > threshold).

### Workers

**`app/workers/reconciliation/log_scraping_worker.rb`** (retry: 2)
- Runs Playwright for each provider, stores results.

**`app/workers/reconciliation/log_matching_worker.rb`** (retry: 2)
- Runs matching service for newly scraped logs.

### Schedule

Daily at 06:00 UTC (off-peak, after nightly maintenance):

```ruby
category "Reconciliation" do
  every(1.day, "scrape provider request logs", at: "06:00") do
    Reconciliation::LogScrapingWorker.perform_async
  end
end
```

### Important Implementation Notes

- **Iterative build**: First implementation should manually inspect each provider's logs page to catalog available fields and authentication flow before automating.
- **Fragility**: Console UIs change. Build with defensive parsing - log warnings for unexpected formats, don't crash.
- **Matching heuristic**: The timestamp + model + token count matching is approximate. If providers show request IDs, and we can capture those in `llm_usage.metadata`, matching becomes exact. Worth adding request ID capture to the Langgraph `UsageTrackingCallbackHandler` if Anthropic response headers include one.
- **Infrastructure**: Production server needs Chromium installed. Add to Dockerfile if not present.

---

## Phase 4: Admin Visibility (Future)

- Admin API endpoints for reconciliation status, run details, discrepancy resolution
- React admin page showing recent runs, open discrepancies, trends
- Slack integration for critical alerts
- Manual trigger endpoint for on-demand reconciliation
- Dashboard showing: matched %, unmatched provider logs, cost deltas by provider

---

## Key Files to Modify/Create

### Phase 1 (new files)
| File | Type |
|------|------|
| `db/migrate/XXXX_create_reconciliation_runs.rb` | Migration |
| `db/migrate/XXXX_create_reconciliation_discrepancies.rb` | Migration |
| `app/models/reconciliation_run.rb` | Model |
| `app/models/reconciliation_discrepancy.rb` | Model |
| `app/services/reconciliation/internal_audit_service.rb` | Service |
| `app/services/reconciliation/account_billing_audit_service.rb` | Service |
| `app/services/reconciliation/alert_service.rb` | Service |
| `app/workers/reconciliation/hourly_reconciliation_worker.rb` | Worker |
| `app/workers/reconciliation/internal_audit_worker.rb` | Worker |
| `app/workers/reconciliation/account_billing_audit_worker.rb` | Worker |
| `app/workers/reconciliation/finalize_run_worker.rb` | Worker |
| `spec/factories/reconciliation_runs.rb` | Factory |
| `spec/factories/reconciliation_discrepancies.rb` | Factory |
| `spec/services/reconciliation/internal_audit_service_spec.rb` | Test |
| `spec/services/reconciliation/account_billing_audit_service_spec.rb` | Test |
| `spec/services/reconciliation/alert_service_spec.rb` | Test |
| `spec/workers/reconciliation/*_spec.rb` | Tests |
| `spec/models/reconciliation_run_spec.rb` | Test |
| `spec/models/reconciliation_discrepancy_spec.rb` | Test |

### Phase 1 (modified files)
| File | Change |
|------|--------|
| `schedule.rb` | Add hourly reconciliation to Credits category |

### Phase 2 (new files)
| File | Type |
|------|------|
| `db/migrate/XXXX_create_provider_usage_snapshots.rb` | Migration |
| `app/models/provider_usage_snapshot.rb` | Model |
| `app/clients/anthropic_admin_client.rb` | Client |
| `app/services/reconciliation/provider_ingestion_service.rb` | Service |
| `app/services/reconciliation/provider_comparison_service.rb` | Service |
| `app/workers/reconciliation/provider_ingestion_worker.rb` | Worker |
| `app/workers/reconciliation/provider_comparison_worker.rb` | Worker |

### Phase 3 (new files)
| File | Type |
|------|------|
| `db/migrate/XXXX_create_provider_request_logs.rb` | Migration |
| `app/models/provider_request_log.rb` | Model |
| `scripts/reconciliation/scrape_anthropic_logs.ts` | Playwright script |
| `scripts/reconciliation/scrape_groq_logs.ts` | Playwright script |
| `app/services/reconciliation/log_scraping_service.rb` | Service |
| `app/services/reconciliation/log_matching_service.rb` | Service |
| `app/workers/reconciliation/log_scraping_worker.rb` | Worker |
| `app/workers/reconciliation/log_matching_worker.rb` | Worker |

### Critical reference files (reuse, don't duplicate)
| File | Why |
|------|-----|
| `app/services/credits/cost_calculator.rb` | Re-used in cost accuracy check |
| `app/services/credits/model_normalizer.rb` | Re-used for model name matching in provider comparison |
| `app/models/credit_transaction.rb` | `.latest_for_account`, scopes for querying |
| `app/models/llm_usage.rb` | `.unprocessed`, `.for_run` scopes |
| `app/clients/application_client.rb` | Base class for `AnthropicAdminClient` |

---

## Verification Plan

### Unit Tests
- `InternalAuditService`: seed llm_usage with known issues (unprocessed, zero-token, cost mismatch), verify correct discrepancies created
- `AccountBillingAuditService`: create accounts with drift between usage sum and transaction sum, verify detection
- `ProviderComparisonService`: stub snapshots with known deltas, verify thresholds work
- `AlertService`: verify Rollbar called for critical, not for clean runs

### Integration Test
- Create a full billing scenario (LLMUsage records -> ChargeRunWorker -> CreditTransactions)
- Run `HourlyReconciliationWorker` for that period
- Verify `ReconciliationRun` completed with 0 discrepancies (happy path)
- Introduce a bug (delete a transaction), re-run, verify critical discrepancy detected

### Manual Verification
- Deploy Phase 1, let it run for 24 hours
- Check `ReconciliationRun.recent` in Rails console
- Verify no unexpected discrepancies
- Intentionally break something in staging (e.g., disable `ChargeRunWorker`), verify reconciliation catches it within 1 hour
