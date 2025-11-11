namespace :seeds do
  desc "Load plan seeds"
  task plans: :environment do
    plan_limits = {
      requests_per_month: {
        starter: 1_000_000,
        pro: 5_000_000,
        enterprise: 20_000_000
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
    Plan.all.each { |plan| plan.send(:sync_to_atlas_on_create) }
  end
end
