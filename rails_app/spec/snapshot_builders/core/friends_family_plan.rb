module Core
  class FriendsFamilyPlan < BaseBuilder
    def seed
      puts "Seeding friends & family plan..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      # Ensure base tiers/plans exist first
      Core::PlanTiers.new.seed
      Core::TierLimits.new.seed

      # Create F&F tier with 0 monthly credits (uses gifted pack credits)
      ff_tier = PlanTier.find_or_create_by!(name: "friends_family") do |tier|
        tier.description = "Friends & family testing access"
        tier.details = {
          features: [
            "Full access for testing",
            "Gifted credits only",
            "No monthly renewal"
          ],
          credits: 0
        }
      end

      # Match growth tier limits (generous access for testers)
      PlanTier.find_by!(name: "growth")
      Core::TierLimits::LIMITS.each do |limit_type, tier_values|
        growth_limit = tier_values[:growth]
        TierLimit.find_or_create_by!(tier: ff_tier, limit_type: limit_type) do |tl|
          tl.limit = growth_limit
        end
      end

      # Create hidden $0 plan using fake processor (no Stripe)
      Plan.find_or_create_by!(name: "friends_family") do |plan|
        plan.amount = 0
        plan.interval = "month"
        plan.hidden = true
        plan.fake_processor_id = "friends_family"
        plan.currency = "usd"
        plan.plan_tier_id = ff_tier.id
      end

      puts "Friends & family plan seeded"
    end
  end
end
