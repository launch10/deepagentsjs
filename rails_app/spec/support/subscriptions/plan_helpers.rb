# Helper methods for managing plans in tests
module PlanHelpers
  # Load plans from the seed file instead of creating them with factories
  def load_plan_seeds
    # Simply create the default plans directly
    # Trying to load rake tasks in tests adds unnecessary complexity
    create_default_plans
  end

  # Create the same plans as defined in seeds
  def create_default_plans
    # First, create plan tiers
    tiers_data = [
      {
        name: "starter",
        description: "Perfect for solo founders testing the waters",
        details: {features: ["1M requests/month", "1 subdomain"], credits: 2000}
      },
      {
        name: "growth",
        description: "For serious founders ready to validate at scale",
        details: {features: ["5M requests/month", "2 subdomains"], credits: 5000}
      },
      {
        name: "pro",
        description: "Maximum validation for teams with multiple ventures",
        details: {features: ["20M requests/month", "3 subdomains"], credits: 15000}
      }
    ]

    tiers_data.each do |tier_attrs|
      PlanTier.find_or_create_by!(name: tier_attrs[:name]) do |tier|
        tier.description = tier_attrs[:description]
        tier.details = tier_attrs[:details]
      end
    end

    starter_tier = PlanTier.find_by!(name: "starter")
    growth_tier = PlanTier.find_by!(name: "growth")
    pro_tier = PlanTier.find_by!(name: "pro")

    # Create tier limits
    tier_limits_data = [
      {tier_id: starter_tier.id, limit_type: "requests_per_month", limit: 1_000_000},
      {tier_id: starter_tier.id, limit_type: "platform_subdomains", limit: 1},
      {tier_id: growth_tier.id, limit_type: "requests_per_month", limit: 5_000_000},
      {tier_id: growth_tier.id, limit_type: "platform_subdomains", limit: 2},
      {tier_id: pro_tier.id, limit_type: "requests_per_month", limit: 20_000_000},
      {tier_id: pro_tier.id, limit_type: "platform_subdomains", limit: 3}
    ]

    tier_limits_data.each do |limit_attrs|
      TierLimit.find_or_create_by!(tier_id: limit_attrs[:tier_id], limit_type: limit_attrs[:limit_type]) do |tl|
        tl.limit = limit_attrs[:limit]
      end
    end

    # Create plans (matching production naming: tier_interval)
    plans_data = [
      {
        name: "starter_monthly",
        amount: 7900,
        interval: "month",
        stripe_id: "starter_monthly",
        fake_processor_id: "starter_monthly",
        plan_tier_id: starter_tier.id
      },
      {
        name: "growth_monthly",
        amount: 14900,
        interval: "month",
        stripe_id: "growth_monthly",
        fake_processor_id: "growth_monthly",
        plan_tier_id: growth_tier.id
      },
      {
        name: "pro_monthly",
        amount: 39900,
        interval: "month",
        stripe_id: "pro_monthly",
        fake_processor_id: "pro_monthly",
        plan_tier_id: pro_tier.id
      }
    ]

    plans_data.each do |plan_attrs|
      Plan.find_or_create_by!(name: plan_attrs[:name]) do |plan|
        plan.amount = plan_attrs[:amount]
        plan.interval = plan_attrs[:interval]
        plan.stripe_id = plan_attrs[:stripe_id]
        plan.fake_processor_id = plan_attrs[:fake_processor_id]
        plan.plan_tier_id = plan_attrs[:plan_tier_id]
      end
    end

    # Friends & Family plan (hidden, $0, no monthly credits)
    ff_tier = PlanTier.find_or_create_by!(name: "friends_family") do |tier|
      tier.description = "Friends & family testing access"
      tier.details = {features: ["Full access for testing", "Gifted credits only"], credits: 0}
    end

    Plan.find_or_create_by!(name: "friends_family") do |plan|
      plan.amount = 0
      plan.interval = "month"
      plan.hidden = true
      plan.fake_processor_id = "friends_family"
      plan.plan_tier_id = ff_tier.id
    end
  end

  def ensure_plans_exist
    # Check if plans exist, if not load them
    if Plan.count == 0
      load_plan_seeds
    end
  end

  def starter_plan
    ensure_plans_exist
    Plan.find_by(name: "starter_monthly")
  end

  def growth_plan
    ensure_plans_exist
    Plan.find_by(name: "growth_monthly")
  end

  def pro_plan
    ensure_plans_exist
    Plan.find_by(name: "pro_monthly")
  end

  def create_tier_limit(tier, limit_type, limit)
    TierLimit.find_or_create_by!(tier: tier, limit_type: limit_type) do |tl|
      tl.limit = limit
    end.tap { |tl| tl.update!(limit: limit) }
  end

  # Backward compatibility - creates tier limit for a plan's tier
  def create_plan_limit(plan, limit_type, limit)
    tier = plan.plan_tier || create(:plan_tier)
    plan.update!(plan_tier: tier) unless plan.plan_tier
    create_tier_limit(tier, limit_type, limit)
  end
end

RSpec.configure do |config|
  config.include PlanHelpers
end
