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
        {
          name: "starter",
          amount: 4900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :starter, :monthly),
          currency: "usd"
        },
        {
          name: "pro",
          amount: 9900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :pro, :monthly),
          currency: "usd"
        },
        {
          name: "enterprise",
          amount: 24900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :enterprise, :monthly),
          currency: "usd"
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
