# Scope 1: Database Foundation

## Context

This scope creates the database tables required for the billing system. It follows the completed Langgraph Usage Tracking spike which validated:
- UsageRecord fields (tokens, model, IDs)
- AsyncLocalStorage context isolation
- Callback mechanics (handleChatModelStart, handleLLMEnd)
- Provider-specific field extraction (Anthropic, OpenAI)

**Note**: Rails calculates cost when processing records - Langgraph only writes raw token counts.

## Conventions

Per `rails_app/.claude/skills/rails-migrations.md`:
- **Never use `references`** - use `bigint` instead
- **Always add indexes concurrently** with `disable_ddl_transaction!`
- **No foreign key constraints** - just bigint columns with indexes
- **Use cents** for all monetary values (not USD decimals)

## Tables to Create

### 1. llm_usage (Langgraph writes directly)

Individual LLM calls from graph executions. Langgraph writes raw usage data; Rails calculates cost when charging credits.

```ruby
class CreateLlmUsage < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :llm_usage do |t|
      t.bigint :chat_id, null: false
      t.string :run_id, null: false           # Graph execution UUID
      t.string :message_id                    # Provider's message ID (e.g., "msg_01BeRf...")
      t.string :langchain_run_id              # LangChain callback run ID
      t.string :parent_langchain_run_id
      t.string :graph_name

      t.string :model_raw, null: false        # Raw model from provider (e.g., "claude-haiku-4-5-20251001")

      # Token counts - written by Langgraph
      t.integer :input_tokens, null: false, default: 0
      t.integer :output_tokens, null: false, default: 0
      t.integer :reasoning_tokens, default: 0        # OpenAI o1/o3 models
      t.integer :cache_creation_tokens, default: 0   # Anthropic cache
      t.integer :cache_read_tokens, default: 0       # Anthropic cache

      # Cost in cents - calculated by Rails when processing
      # Using bigint for sub-cent precision (microcents: 1 cent = 10000)
      t.bigint :cost_microcents                      # NULL until Rails calculates

      t.string :tags, array: true, default: []
      t.jsonb :metadata

      t.datetime :processed_at                       # NULL = not yet charged by Rails
      t.timestamps
    end

    add_index :llm_usage, :run_id, algorithm: :concurrently
    add_index :llm_usage, [:chat_id, :run_id], algorithm: :concurrently
    add_index :llm_usage, [:processed_at, :created_at], algorithm: :concurrently
  end
end
```

### 2. credit_transactions (Ledger - source of truth)

Append-only ledger with denormalized running balances. No balance columns on Account.

```ruby
class CreateCreditTransactions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_transactions do |t|
      t.bigint :account_id, null: false

      # Transaction classification
      t.string :transaction_type, null: false   # allocate, consume, purchase, refund, gift, adjust
      t.string :credit_type, null: false        # plan, pack
      t.string :reason, null: false             # plan_renewal, pack_purchase, ai_generation, etc.

      # Amount and running balances (source of truth)
      t.bigint :amount, null: false             # positive=credit, negative=debit
      t.bigint :balance_after, null: false      # total balance after this transaction
      t.bigint :plan_balance_after, null: false
      t.bigint :pack_balance_after, null: false

      # Reference (string-based, not polymorphic AR)
      t.string :reference_type                  # "llm_run", "CreditPackPurchase", "Pay::Subscription", etc.
      t.string :reference_id

      t.jsonb :metadata, default: {}
      t.string :idempotency_key

      t.timestamps
    end

    add_index :credit_transactions, [:account_id, :created_at], algorithm: :concurrently
    add_index :credit_transactions, [:reference_type, :reference_id], algorithm: :concurrently
    add_index :credit_transactions, :idempotency_key, unique: true, where: "idempotency_key IS NOT NULL", algorithm: :concurrently
  end
end
```

### 3. credit_packs (Pack type definitions)

Like `Plan` - defines pack types available for purchase.

```ruby
class CreateCreditPacks < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_packs do |t|
      t.string :name, null: false             # "Small", "Mid", "Big"
      t.integer :credits, null: false         # 500, 1250, 3000
      t.integer :price_cents, null: false     # 2500, 5000, 10000 (cents)
      t.string :currency, default: 'usd'
      t.string :stripe_price_id               # Links to Stripe Price
      t.boolean :visible, default: true

      t.timestamps
    end

    add_index :credit_packs, :name, unique: true, algorithm: :concurrently
  end
end
```

### 4. credit_pack_purchases (Individual purchases)

Like `Pay::Subscription` - tracks individual pack purchases.

```ruby
class CreateCreditPackPurchases < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_pack_purchases do |t|
      t.bigint :account_id, null: false
      t.bigint :credit_pack_id, null: false
      t.bigint :pay_charge_id                 # Links to Pay::Charge

      t.integer :credits_purchased, null: false   # Snapshot at purchase time
      t.integer :price_cents, null: false         # Snapshot at purchase time
      t.boolean :is_used, null: false, default: false  # True when fully consumed

      t.timestamps
    end

    add_index :credit_pack_purchases, :account_id, algorithm: :concurrently
    add_index :credit_pack_purchases, :credit_pack_id, algorithm: :concurrently
    add_index :credit_pack_purchases, :pay_charge_id, algorithm: :concurrently
    add_index :credit_pack_purchases, [:account_id, :is_used], algorithm: :concurrently
    add_index :credit_pack_purchases, [:account_id, :created_at], algorithm: :concurrently
  end
end
```

### 5. conversation_traces (Partitioned by month)

Full message traces for learning/analytics. Written directly by Langgraph.

```ruby
class CreateConversationTraces < ActiveRecord::Migration[8.0]
  def change
    # Partitioned table - cannot use disable_ddl_transaction! with partitions
    execute <<-SQL
      CREATE TABLE conversation_traces (
        id bigserial,
        chat_id bigint NOT NULL,
        thread_id varchar NOT NULL,
        run_id varchar NOT NULL,
        graph_name varchar,
        messages jsonb NOT NULL,
        system_prompt text,
        usage_summary jsonb,
        llm_calls jsonb,
        created_at timestamp NOT NULL,
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);

      CREATE UNIQUE INDEX conversation_traces_run_id_created_at_idx
        ON conversation_traces (run_id, created_at);
      CREATE INDEX conversation_traces_thread_id_created_at_idx
        ON conversation_traces (thread_id, created_at);
      CREATE INDEX conversation_traces_chat_id_created_at_idx
        ON conversation_traces (chat_id, created_at);

      -- Initial partitions for 2026
      CREATE TABLE conversation_traces_2026_01
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

      CREATE TABLE conversation_traces_2026_02
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

      CREATE TABLE conversation_traces_2026_03
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
    SQL
  end

  def down
    execute <<-SQL
      DROP TABLE IF EXISTS conversation_traces CASCADE;
    SQL
  end
end
```

### 6. model_configs (Add reasoning pricing column)

Existing table already has cache pricing (cache_writes, cache_reads).
Add reasoning pricing for OpenAI o1/o3 models.
All pricing in dollars per 1M tokens (same format as cost_in, cost_out).

```ruby
class AddReasoningCostToModelConfigs < ActiveRecord::Migration[8.0]
  def change
    # Pricing in dollars per 1M tokens (same format as cost_in, cost_out)
    # For OpenAI o1/o3 models reasoning tokens
    add_column :model_configs, :cost_reasoning, :decimal, precision: 10, scale: 4
  end
end
```

**Pricing reference (dollars per 1M tokens):**

| Model | Input | Output | Cache Write | Cache Read | Reasoning |
|-------|-------|--------|-------------|------------|-----------|
| claude-sonnet-4-20250514 | 3.00 | 15.00 | 3.75 | 0.30 | - |
| claude-haiku-35-20241022 | 0.80 | 4.00 | 1.00 | 0.08 | - |
| o1 | 15.00 | 60.00 | - | - | 60.00 |

## Files Created

| File | Purpose |
|------|---------|
| `db/migrate/20260123210745_create_llm_usage.rb` | LLM call tracking for billing |
| `db/migrate/20260123210921_create_credit_transactions.rb` | Ledger for all credit changes |
| `db/migrate/20260123211021_create_credit_packs.rb` | Pack type definitions |
| `db/migrate/20260123211123_create_credit_pack_purchases.rb` | Purchase instances |
| `db/migrate/20260123211228_create_conversation_traces.rb` | Partitioned trace storage |
| `db/migrate/20260123211427_add_reasoning_cost_to_model_configs.rb` | Reasoning pricing for o1/o3 |

## Models to Create

| File | Purpose |
|------|---------|
| `app/models/llm_usage.rb` | LlmUsage model |
| `app/models/credit_transaction.rb` | CreditTransaction model |
| `app/models/credit_pack.rb` | CreditPack model |
| `app/models/credit_pack_purchase.rb` | CreditPackPurchase model |
| `app/models/conversation_trace.rb` | ConversationTrace model |

## Red/Green/Refactor Implementation Order

### Step 1: LlmUsage (RED -> GREEN)
1. Write model spec `spec/models/llm_usage_spec.rb`
2. Create migration + model to make tests pass

### Step 2: CreditTransaction (RED -> GREEN)
1. Write model spec `spec/models/credit_transaction_spec.rb`
2. Create migration + model to make tests pass

### Step 3: CreditPack (RED -> GREEN)
1. Write model spec `spec/models/credit_pack_spec.rb`
2. Create migration + model to make tests pass

### Step 4: CreditPackPurchase (RED -> GREEN)
1. Write model spec `spec/models/credit_pack_purchase_spec.rb`
2. Create migration + model to make tests pass

### Step 5: ConversationTrace (RED -> GREEN)
1. Write model spec `spec/models/conversation_trace_spec.rb`
2. Create migration + model to make tests pass

### Step 6: ModelConfig additions (RED -> GREEN)
1. Update model spec `spec/models/model_config_spec.rb`
2. Create migration to add columns

## Verification

1. **Run tests**: `bundle exec rspec spec/models/llm_usage_spec.rb spec/models/credit_transaction_spec.rb spec/models/credit_pack_spec.rb spec/models/credit_pack_purchase_spec.rb spec/models/conversation_trace_spec.rb`
2. **Run migrations**: `bundle exec rails db:migrate`
3. **Verify tables exist**:
   ```bash
   rails runner "puts ActiveRecord::Base.connection.tables.sort"
   ```
4. **Check indexes**:
   ```bash
   rails runner "puts ActiveRecord::Base.connection.indexes('llm_usage').map(&:name)"
   ```
5. **Verify partitions**:
   ```sql
   SELECT tablename FROM pg_tables WHERE tablename LIKE 'conversation_traces%';
   ```

## Dependencies

- **Depends on**: Scope 6 spike (completed) - validated llm_usage schema
- **Blocks**: Scopes 2-9 (all downstream work)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| bigint not references | Project convention | No FK constraints, explicit columns |
| Concurrent indexes | Project convention | Safe for production |
| No FK on llm_usage.chat_id | Langgraph writes directly | Faster writes, no AR overhead |
| No FK on conversation_traces.chat_id | Partition drops | Can drop old partitions without cascade |
| cost_microcents in llm_usage | Sub-cent precision | LLM pricing often fractions of a cent |
| price_cents in credit_packs | Whole cents | Packs are full dollar amounts |
| String-based reference_type/id | Flexible references | Can reference UUIDs, AR models, etc. |
| Partitioned traces | Monthly | Efficient archival, instant partition drops |
| Decimal for model_configs pricing | Consistency | Match existing cost_in, cost_out format |

## Notes

- Run `pnpm run db:reflect` in langgraph_app after Rails migrations to update Drizzle schema
- Initial partitions cover Jan-Mar 2026; ManageTracePartitionsJob (Scope 2) handles future months
- PlanTier.details[:credits] already exists - no migration needed for plan credits source
- model_configs already had cache_writes/cache_reads columns - only added cost_reasoning

## Status: COMPLETED

All migrations run, all tests passing (88 examples, 0 failures).
