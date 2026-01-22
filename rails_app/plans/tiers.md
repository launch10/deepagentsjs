# Plan Architecture Refactoring: PlanTier Implementation

## Summary

Introduce a `PlanTier` model to normalize tier-level data (description, features, credits, limits) while keeping the existing `Plan` model for billing-cycle-specific data (amount, interval, stripe_id). Rename `PlanLimit` to `TierLimit` and associate with tiers instead of individual plans.

---

## Architecture Overview

### Before
```
Plan (starter_monthly)     Plan (starter_annual)
├── description            ├── description         ← DUPLICATED
├── features               ├── features            ← DUPLICATED
├── details[:credits]      ├── details[:credits]   ← DUPLICATED
├── amount: 7900           ├── amount: 70800       ← DIFFERENT (legitimate)
├── interval: month        ├── interval: year      ← DIFFERENT (legitimate)
└── stripe_id              └── stripe_id           ← DIFFERENT (legitimate)

PlanLimit (starter_monthly)    PlanLimit (starter_annual)
├── requests_per_month: 1M     ├── requests_per_month: 1M   ← DUPLICATED
└── platform_subdomains: 1     └── platform_subdomains: 1   ← DUPLICATED
```

### After
```
PlanTier (starter)
├── name: "starter"
├── description: "Perfect for solo founders..."
├── features: ["Feature 1", "Feature 2"]
├── credits: 2000
└── tier_limits
    ├── requests_per_month: 1M
    └── platform_subdomains: 1

Plan (starter_monthly)         Plan (starter_annual)
├── plan_tier_id → starter     ├── plan_tier_id → starter
├── amount: 7900               ├── amount: 70800
├── interval: month            ├── interval: year
└── stripe_id: price_xxx       └── stripe_id: price_yyy
```

---

## Database Migrations

### Migration 1: Create plan_tiers table
```ruby
# db/migrate/YYYYMMDDHHMMSS_create_plan_tiers.rb
class CreatePlanTiers < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_tiers do |t|
      t.string :name, null: false
      t.string :description
      t.jsonb :details, default: {}
      t.timestamps
    end

    add_index :plan_tiers, :name, unique: true
  end
end
```

### Migration 2: Add plan_tier_id to plans
```ruby
# db/migrate/YYYYMMDDHHMMSS_add_plan_tier_to_plans.rb
class AddPlanTierToPlans < ActiveRecord::Migration[8.0]
  def change
    add_reference :plans, :plan_tier, foreign_key: true
  end
end
```

### Migration 3: Create tier_limits table (rename from plan_limits)
```ruby
# db/migrate/YYYYMMDDHHMMSS_create_tier_limits.rb
class CreateTierLimits < ActiveRecord::Migration[8.0]
  def change
    create_table :tier_limits do |t|
      t.references :plan_tier, null: false, foreign_key: true
      t.string :limit_type, null: false
      t.integer :limit, null: false, default: 0
      t.timestamps
    end

    add_index :tier_limits, [:plan_tier_id, :limit_type], unique: true
  end
end
```

### Migration 4: Data migration
```ruby
# db/migrate/YYYYMMDDHHMMSS_migrate_plans_to_tiers.rb
class MigratePlansToTiers < ActiveRecord::Migration[8.0]
  def up
    # Create tiers from existing plans
    tier_data = {
      'starter' => Plan.find_by("name LIKE 'starter%'"),
      'growth' => Plan.find_by("name LIKE 'growth%'"),
      'pro' => Plan.find_by("name LIKE 'pro%'")
    }

    tier_data.each do |tier_name, plan|
      next unless plan

      tier = PlanTier.create!(
        name: tier_name,
        description: plan.description,
        details: {
          features: plan.features,
          credits: plan.details&.dig('credits') || 0
        }
      )

      # Migrate limits from this plan to the tier
      PlanLimit.where(plan_id: plan.id).find_each do |pl|
        TierLimit.create!(
          plan_tier_id: tier.id,
          limit_type: pl.limit_type,
          limit: pl.limit
        )
      end

      # Associate all plans of this tier
      Plan.where("name LIKE ?", "#{tier_name}%").update_all(plan_tier_id: tier.id)
    end
  end

  def down
    Plan.update_all(plan_tier_id: nil)
    TierLimit.delete_all
    PlanTier.delete_all
  end
end
```

### Migration 5: Remove plan_limits table (after verification)
```ruby
# db/migrate/YYYYMMDDHHMMSS_drop_plan_limits.rb
class DropPlanLimits < ActiveRecord::Migration[8.0]
  def up
    drop_table :plan_limits
  end

  def down
    create_table :plan_limits do |t|
      t.references :plan, null: false, foreign_key: true
      t.string :limit_type, null: false
      t.integer :limit, null: false, default: 0
      t.timestamps
    end
    add_index :plan_limits, [:plan_id, :limit_type], unique: true
  end
end
```

### Migration 6: Remove redundant columns from plans (optional, after verification)
```ruby
# db/migrate/YYYYMMDDHHMMSS_remove_tier_data_from_plans.rb
class RemoveTierDataFromPlans < ActiveRecord::Migration[8.0]
  def change
    # Remove description since it now lives on PlanTier
    remove_column :plans, :description, :string

    # Note: Keep details column for stripe_tax and any plan-specific data
    # Features and credits will be accessed via plan_tier
  end
end
```

---

## Model Changes

### New: app/models/plan_tier.rb
```ruby
class PlanTier < ApplicationRecord
  include Atlas::PlanTier  # If Atlas sync needed at tier level

  has_many :plans, dependent: :nullify
  has_many :tier_limits, dependent: :destroy
  alias_method :limits, :tier_limits

  store_accessor :details, :features, :credits

  validates :name, presence: true, uniqueness: true

  # Ensure credits is always an integer
  def credits
    super.to_i
  end

  def credits=(value)
    super(value.to_i)
  end

  # Get a specific limit
  def limit_for(limit_type)
    tier_limits.find_by(limit_type: limit_type)&.limit || 0
  end

  def display_name
    name.titleize
  end
end
```

### New: app/models/tier_limit.rb
```ruby
class TierLimit < ApplicationRecord
  belongs_to :plan_tier, touch: true

  validates :limit_type, presence: true, uniqueness: { scope: :plan_tier_id }
  validates :limit, presence: true, numericality: { greater_than_or_equal_to: 0 }

  after_commit :sync_tier_to_atlas

  private

  def sync_tier_to_atlas
    plan_tier.sync_to_atlas if plan_tier.respond_to?(:sync_to_atlas)
  end
end
```

### Modified: app/models/plan.rb
```ruby
class Plan < ApplicationRecord
  include Atlas::Plan
  has_prefix_id :plan

  belongs_to :plan_tier, optional: true

  # REMOVED: has_many :plan_limits (now on PlanTier)

  store_accessor :details, :stripe_tax  # Keep stripe_tax, remove features/credits

  # Delegate tier-level attributes
  delegate :description, :features, :credits, :display_name, to: :plan_tier, allow_nil: true
  delegate :tier_limits, :limits, to: :plan_tier, allow_nil: true

  # Backward compatibility: returns tier limits or empty array
  def plan_limits
    plan_tier&.tier_limits || TierLimit.none
  end

  # Convenience method for limit lookups
  def limit_for(limit_type)
    plan_tier&.limit_for(limit_type) || 0
  end

  def monthly_request_limit
    limit_for('requests_per_month')
  end
  alias_method :usage_limit, :monthly_request_limit

  # Extract tier name from plan name (fallback if no plan_tier)
  def tier_name
    plan_tier&.name || name.gsub(/_monthly|_annual|_yearly/, '')
  end

  # Keep existing methods
  def monthly?
    interval == "month"
  end

  def annual?
    interval == "year"
  end
  alias_method :yearly?, :annual?

  def find_interval_plan
    if monthly?
      Plan.find_by(name: name.gsub(/_monthly$/, '_annual'))
    else
      Plan.find_by(name: name.gsub(/_annual$/, '_monthly'))
    end
  end
end
```

---

## Service & Controller Changes

### app/services/credit_service.rb
```ruby
# Change from:
StripeConfig.credits_for_plan_model(plan)

# To:
plan.credits
# or
plan.plan_tier.credits
```

### config/initializers/stripe_config.rb
```ruby
# REMOVE the PLAN_TO_TIER and TIER_CREDITS constants
# They're now in the database

module StripeConfig
  # Keep any Stripe-specific config that's not tier-related
  # Remove:
  # - TIER_CREDITS
  # - PLAN_TO_TIER
  # - credits_for_plan methods
end
```

### app/models/account.rb
```ruby
# Update limit access
def plan_limits
  plan&.plan_tier&.tier_limits || TierLimit.none
end

def monthly_request_limit
  plan&.monthly_request_limit || 0
end

# These should work unchanged due to delegation:
def over_monthly_request_limit?
  request_count > monthly_request_limit
end
```

### app/models/domain.rb
```ruby
def subdomain_limit
  # Change from:
  # account.plan_limits.find { |pl| pl.limit_type == "platform_subdomains" }&.limit

  # To:
  account.plan&.limit_for('platform_subdomains') || 0
end
```

### app/controllers/api/v1/domains_controller.rb
```ruby
def platform_subdomain_credits
  limit = current_account.plan&.limit_for('platform_subdomains') || 0
  used = current_account.domains.platform_subdomains.count
  { limit: limit, used: used, remaining: [limit - used, 0].max }
end
```

### app/models/account_request_count.rb
```ruby
def over_limit?
  return false unless limit
  request_count >= limit
end

def limit
  # Change from looking up PlanLimit directly
  # To:
  account&.plan&.limit_for('requests_per_month')
end

def usage_percentage
  return 0 unless limit && limit > 0
  (request_count.to_f / limit * 100).round(1)
end
```

---

## Atlas Integration Changes

### app/models/concerns/atlas/plan.rb
```ruby
# Update to sync tier-level data
def atlas_plan_params
  {
    id: id,
    name: tier_name,
    usageLimit: monthly_request_limit  # Now from tier
  }
end
```

### Consider: app/models/concerns/atlas/plan_tier.rb (new)
```ruby
module Atlas
  module PlanTier
    extend ActiveSupport::Concern

    included do
      after_create_commit :sync_tier_to_atlas
      after_update_commit :sync_tier_to_atlas
    end

    def sync_tier_to_atlas
      # Sync all plans of this tier
      plans.each(&:sync_to_atlas)
    end
  end
end
```

---

## Langgraph Schema Updates

### langgraph_app/app/db/schema.ts
```typescript
// Add planTiers table
export const planTiers = pgTable("plan_tiers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add tierLimits table
export const tierLimits = pgTable("tier_limits", {
  id: serial("id").primaryKey(),
  planTierId: integer("plan_tier_id").notNull().references(() => planTiers.id),
  limitType: varchar("limit_type", { length: 255 }).notNull(),
  limit: integer("limit").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLimit: unique().on(table.planTierId, table.limitType),
}));

// Update plans table
export const plans = pgTable("plans", {
  // ... existing fields
  planTierId: integer("plan_tier_id").references(() => planTiers.id),
});

// Remove planLimits table after migration
```

---

## Seed/Factory Updates

### spec/snapshot_builders/core/plan_tiers.rb (new)
```ruby
module SnapshotBuilders
  module Core
    class PlanTiers
      def self.build
        tiers = [
          {
            name: 'starter',
            description: 'Perfect for solo founders testing the waters',
            details: { features: ['1M requests/month', '1 subdomain'], credits: 2_000 }
          },
          {
            name: 'growth',
            description: 'For serious founders ready to validate at scale',
            details: { features: ['5M requests/month', '2 subdomains'], credits: 5_000 }
          },
          {
            name: 'pro',
            description: 'Maximum validation for teams with multiple ventures',
            details: { features: ['20M requests/month', '3 subdomains'], credits: 15_000 }
          }
        ]

        tiers.each do |tier_attrs|
          PlanTier.find_or_create_by!(name: tier_attrs[:name]) do |tier|
            tier.description = tier_attrs[:description]
            tier.details = tier_attrs[:details]
          end
        end
      end
    end
  end
end
```

### spec/snapshot_builders/core/tier_limits.rb (new)
```ruby
module SnapshotBuilders
  module Core
    class TierLimits
      LIMITS = {
        'requests_per_month' => { starter: 1_000_000, growth: 5_000_000, pro: 20_000_000 },
        'platform_subdomains' => { starter: 1, growth: 2, pro: 3 }
      }

      def self.build
        LIMITS.each do |limit_type, tier_values|
          tier_values.each do |tier_name, limit_value|
            tier = PlanTier.find_by!(name: tier_name.to_s)
            TierLimit.find_or_create_by!(plan_tier: tier, limit_type: limit_type) do |tl|
              tl.limit = limit_value
            end
          end
        end
      end
    end
  end
end
```

### spec/snapshot_builders/core/plans.rb (updated)
```ruby
module SnapshotBuilders
  module Core
    class Plans
      def self.build
        # Ensure tiers exist first
        PlanTiers.build
        TierLimits.build

        plans = [
          { name: 'starter_monthly', tier: 'starter', amount: 7900, interval: 'month' },
          { name: 'starter_annual', tier: 'starter', amount: 70800, interval: 'year' },
          { name: 'growth_monthly', tier: 'growth', amount: 14900, interval: 'month' },
          { name: 'growth_annual', tier: 'growth', amount: 142800, interval: 'year' },
          { name: 'pro_monthly', tier: 'pro', amount: 39900, interval: 'month' },
          { name: 'pro_annual', tier: 'pro', amount: 358800, interval: 'year' }
        ]

        plans.each do |plan_attrs|
          tier = PlanTier.find_by!(name: plan_attrs[:tier])
          Plan.find_or_create_by!(name: plan_attrs[:name]) do |plan|
            plan.plan_tier = tier
            plan.amount = plan_attrs[:amount]
            plan.interval = plan_attrs[:interval]
            plan.stripe_id = "price_#{plan_attrs[:name]}_test"
          end
        end
      end
    end
  end
end
```

### spec/factories/plan_tier.rb (new)
```ruby
FactoryBot.define do
  factory :plan_tier do
    sequence(:name) { |n| "tier_#{n}" }
    description { "Test tier description" }
    details { { features: ['Feature 1'], credits: 1000 } }

    trait :starter do
      name { 'starter' }
      description { 'Perfect for solo founders' }
      details { { features: ['1M requests'], credits: 2000 } }
    end

    trait :growth do
      name { 'growth' }
      description { 'For serious founders' }
      details { { features: ['5M requests'], credits: 5000 } }
    end

    trait :pro do
      name { 'pro' }
      description { 'Maximum validation' }
      details { { features: ['20M requests'], credits: 15000 } }
    end
  end
end
```

### spec/factories/tier_limit.rb (new)
```ruby
FactoryBot.define do
  factory :tier_limit do
    association :plan_tier
    limit_type { 'requests_per_month' }
    limit { 1_000_000 }

    trait :platform_subdomains do
      limit_type { 'platform_subdomains' }
      limit { 1 }
    end
  end
end
```

### spec/factories/plan.rb (updated)
```ruby
FactoryBot.define do
  factory :plan do
    sequence(:name) { |n| "plan_#{n}" }
    interval { 'month' }
    amount { 1900 }
    stripe_id { 'price_test' }
    association :plan_tier  # Add this

    trait :starter_monthly do
      name { 'starter_monthly' }
      amount { 7900 }
      interval { 'month' }
      association :plan_tier, :starter
    end

    # ... other traits
  end
end
```

---

## Admin UI Changes

### app/madmin/resources/plan_tier_resource.rb (new)
```ruby
class PlanTierResource < Madmin::Resource
  attribute :id, form: false
  attribute :name
  attribute :description
  attribute :details
  attribute :created_at, form: false
  attribute :updated_at, form: false

  def self.display_name(record)
    record.display_name
  end
end
```

### app/madmin/resources/tier_limit_resource.rb (new)
```ruby
class TierLimitResource < Madmin::Resource
  attribute :id, form: false
  attribute :plan_tier
  attribute :limit_type
  attribute :limit
  attribute :created_at, form: false
  attribute :updated_at, form: false
end
```

---

## Files to Modify (Complete List)

### New Files
- `app/models/plan_tier.rb`
- `app/models/tier_limit.rb`
- `app/models/concerns/atlas/plan_tier.rb` (optional)
- `app/madmin/resources/plan_tier_resource.rb`
- `app/madmin/resources/tier_limit_resource.rb`
- `spec/factories/plan_tier.rb`
- `spec/factories/tier_limit.rb`
- `spec/snapshot_builders/core/plan_tiers.rb`
- `spec/snapshot_builders/core/tier_limits.rb`
- `db/migrate/*_create_plan_tiers.rb`
- `db/migrate/*_add_plan_tier_to_plans.rb`
- `db/migrate/*_create_tier_limits.rb`
- `db/migrate/*_migrate_plans_to_tiers.rb`
- `db/migrate/*_drop_plan_limits.rb`

### Modified Files
- `app/models/plan.rb` - Add belongs_to, delegation, remove has_many :plan_limits
- `app/models/account.rb` - Update plan_limits method
- `app/models/domain.rb` - Update subdomain_limit
- `app/models/account_request_count.rb` - Update limit lookup
- `app/models/concerns/atlas/plan.rb` - Update sync params
- `app/controllers/api/v1/domains_controller.rb` - Update limit lookup
- `app/services/credit_service.rb` - Use plan.credits
- `config/initializers/stripe_config.rb` - Remove tier constants
- `spec/snapshot_builders/core/plans.rb` - Update to use tiers
- `spec/factories/plan.rb` - Add plan_tier association
- `langgraph_app/app/db/schema.ts` - Add new tables

### Files to Delete (after migration verified)
- `app/models/plan_limit.rb`
- `spec/factories/plan_limit.rb`
- `spec/snapshot_builders/core/plan_limits.rb` (if exists)
- `app/madmin/resources/plan_limit_resource.rb` (if exists)

---

## Testing Strategy

### Unit Tests
```ruby
# spec/models/plan_tier_spec.rb
RSpec.describe PlanTier do
  describe '#credits' do
    it 'returns credits from details' do
      tier = create(:plan_tier, details: { credits: 5000 })
      expect(tier.credits).to eq(5000)
    end
  end

  describe '#limit_for' do
    it 'returns limit for given type' do
      tier = create(:plan_tier)
      create(:tier_limit, plan_tier: tier, limit_type: 'requests_per_month', limit: 1_000_000)
      expect(tier.limit_for('requests_per_month')).to eq(1_000_000)
    end
  end
end

# spec/models/plan_spec.rb
RSpec.describe Plan do
  describe 'delegation' do
    let(:tier) { create(:plan_tier, :starter) }
    let(:plan) { create(:plan, plan_tier: tier) }

    it 'delegates credits to tier' do
      expect(plan.credits).to eq(tier.credits)
    end

    it 'delegates description to tier' do
      expect(plan.description).to eq(tier.description)
    end
  end
end
```

### Integration Tests
```ruby
# spec/features/subscriptions_spec.rb
# Ensure subscription flow still works with new architecture
```

### Migration Tests
```ruby
# Run in development first
rails db:migrate
rails db:seed

# Verify:
PlanTier.count # => 3
TierLimit.count # => 6 (2 limit types × 3 tiers)
Plan.where(plan_tier_id: nil).count # => 0
Plan.first.credits # => non-nil
Plan.first.monthly_request_limit # => non-nil
```

---

## Rollout Plan

### Phase 1: Add new tables (non-breaking)
1. Create plan_tiers table
2. Create tier_limits table
3. Add plan_tier_id to plans
4. Deploy - no code changes needed yet

### Phase 2: Migrate data
1. Run data migration to populate tiers and tier_limits
2. Associate plans with tiers
3. Verify all plans have tier associations

### Phase 3: Update code
1. Add PlanTier and TierLimit models
2. Update Plan model with delegation
3. Update services and controllers
4. Deploy

### Phase 4: Cleanup (after verification)
1. Drop plan_limits table
2. Remove description column from plans (optional)
3. Remove StripeConfig tier constants
4. Delete old model/factory files

---

## Verification Checklist

- [ ] All plans have plan_tier_id populated
- [ ] `plan.credits` returns correct value via delegation
- [ ] `plan.description` returns correct value via delegation
- [ ] `plan.monthly_request_limit` returns correct value
- [ ] `account.plan_limits` returns tier limits
- [ ] Domain subdomain limit checks work
- [ ] AccountRequestCount limit checks work
- [ ] CreditService allocates correct credits
- [ ] Subscription creation still works (Pay gem unchanged)
- [ ] Atlas sync includes correct usage limits
- [ ] Admin can view/edit PlanTiers
- [ ] Seeds create tiers before plans
- [ ] All tests pass
