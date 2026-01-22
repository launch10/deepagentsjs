module Core
  class PlanTiers < BaseBuilder
    def seed
      puts "Seeding plan tiers..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      tiers = [
        {
          name: "starter",
          description: "Perfect for solo founders testing the waters",
          details: {features: ["1M requests/month", "1 subdomain"], credits: 2_000}
        },
        {
          name: "growth",
          description: "For serious founders ready to validate at scale",
          details: {features: ["5M requests/month", "2 subdomains"], credits: 5_000}
        },
        {
          name: "pro",
          description: "Maximum validation for teams with multiple ventures",
          details: {features: ["20M requests/month", "3 subdomains"], credits: 15_000}
        }
      ]

      tiers.each do |tier_attrs|
        PlanTier.find_or_create_by!(name: tier_attrs[:name]) do |tier|
          tier.description = tier_attrs[:description]
          tier.details = tier_attrs[:details]
        end
      end

      puts "Plan tiers seeded: #{PlanTier.count} tiers"
    end
  end
end
