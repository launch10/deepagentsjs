module Core
  class TierLimits < BaseBuilder
    LIMITS = {
      "requests_per_month" => {starter: 1_000_000, growth: 5_000_000, pro: 20_000_000},
      "platform_subdomains" => {starter: 1, growth: 2, pro: 3}
    }

    def seed
      puts "Seeding tier limits..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      LIMITS.each do |limit_type, tier_values|
        tier_values.each do |tier_name, limit_value|
          tier = PlanTier.find_by!(name: tier_name.to_s)
          TierLimit.find_or_create_by!(tier: tier, limit_type: limit_type) do |tl|
            tl.limit = limit_value
          end
        end
      end

      puts "Tier limits seeded: #{TierLimit.count} limits"
    end
  end
end
