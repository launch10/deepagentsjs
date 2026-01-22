module Core
  class Plans < BaseBuilder
    def seed
      puts "Seeding plans..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      # Ensure tiers and limits exist first
      PlanTiers.new.seed
      TierLimits.new.seed

      starter_tier = PlanTier.find_by!(name: "starter")
      growth_tier = PlanTier.find_by!(name: "growth")
      pro_tier = PlanTier.find_by!(name: "pro")

      plans = [
        # Starter Plans: $79/month, $59/month billed annually ($708/year)
        {
          name: "starter_monthly",
          amount: 7900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :starter, :monthly),
          currency: "usd",
          plan_tier_id: starter_tier.id
        },
        {
          name: "starter_annual",
          amount: 70800,
          interval: "year",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :starter, :annual),
          currency: "usd",
          plan_tier_id: starter_tier.id
        },

        # Growth Plans: $149/month, $119/month billed annually ($1,428/year)
        {
          name: "growth_monthly",
          amount: 14900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :growth, :monthly),
          currency: "usd",
          plan_tier_id: growth_tier.id
        },
        {
          name: "growth_annual",
          amount: 142800,
          interval: "year",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :growth, :annual),
          currency: "usd",
          plan_tier_id: growth_tier.id
        },

        # Pro Plans: $399/month, $299/month billed annually ($3,588/year)
        {
          name: "pro_monthly",
          amount: 39900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :pro, :monthly),
          currency: "usd",
          plan_tier_id: pro_tier.id
        },
        {
          name: "pro_annual",
          amount: 358800,
          interval: "year",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :pro, :annual),
          currency: "usd",
          plan_tier_id: pro_tier.id
        }
      ]

      plans.each do |plan_attrs|
        Plan.find_or_create_by!(name: plan_attrs[:name]) do |plan|
          plan.amount = plan_attrs[:amount]
          plan.interval = plan_attrs[:interval]
          plan.stripe_id = plan_attrs[:stripe_id]
          plan.currency = plan_attrs[:currency]
          plan.plan_tier_id = plan_attrs[:plan_tier_id]
        end
      end

      puts "Plans seeded: #{Plan.count} plans"
    end
  end
end
