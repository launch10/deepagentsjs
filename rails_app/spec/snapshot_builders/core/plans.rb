module Core
  class Plans < BaseBuilder
    def seed
      puts "Seeding plans..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      plan_limits = {
        requests_per_month: {
          starter: 1_000_000,
          pro: 5_000_000,
          enterprise: 20_000_000
        },
        platform_subdomains: {
          starter: 1,
          pro: 2,
          enterprise: 3
        }
      }

      plans = [
        {
          name: "starter",
          amount: 4900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :starter),
          currency: "usd"
        },
        {
          name: "pro",
          amount: 9900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :pro),
          currency: "usd"
        },
        {
          name: "enterprise",
          amount: 24900,
          interval: "month",
          stripe_id: Rails.application.credentials.dig(:stripe, :plans, :enterprise),
          currency: "usd"
        }
      ]

      Plan.import(plans, on_duplicate_key_update: {conflict_target: :name})

      limits_to_import = plan_limits.map do |limit_type, limits|
        limits.map do |plan_name, limit|
          {
            plan_id: Plan.find_by(name: plan_name).id,
            limit_type: limit_type,
            limit: limit
          }
        end
      end

      PlanLimit.import(limits_to_import.flatten, on_duplicate_key_update: {conflict_target: [:plan_id, :limit_type]})

      puts "Plans seeded: #{Plan.count} plans, #{PlanLimit.count} limits"
    end
  end
end
