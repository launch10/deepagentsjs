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
    plans_data = [
      {
        name: 'starter',
        amount: 4900,
        interval: 'month',
        stripe_id: 'starter',
        fake_processor_id: 'starter'
      },
      {
        name: 'pro',
        amount: 9900,
        interval: 'month', 
        stripe_id: 'business',
        fake_processor_id: 'pro'
      },
      {
        name: 'enterprise',
        amount: 24900,
        interval: 'month',
        stripe_id: 'enterprise',
        fake_processor_id: 'enterprise'
      }
    ]

    Plan.import(
      plans_data,
      on_duplicate_key_update: {
        conflict_target: [:name],
        columns: [:amount, :interval, :stripe_id, :fake_processor_id]
      }
    )

    # Also create plan limits as defined in seeds
    plan_limits_data = [
      {
        plan_id: Plan.find_by(name: 'starter').id,
        limit_type: 'requests_per_month',
        limit: 1_000_000
      },
      {
        plan_id: Plan.find_by(name: 'pro').id,
        limit_type: 'requests_per_month',
        limit: 5_000_000
      },
      {
        plan_id: Plan.find_by(name: 'enterprise').id,
        limit_type: 'requests_per_month',
        limit: 20_000_000
      }
    ]

    PlanLimit.import(
      plan_limits_data,
      on_duplicate_key_update: {
        conflict_target: [:plan_id, :limit_type],
        columns: [:limit]
      }
    )
  end

  def ensure_plans_exist
    # Check if plans exist, if not load them
    if Plan.count == 0
      load_plan_seeds
    end
  end

  def starter_plan
    ensure_plans_exist
    Plan.find_by(name: 'starter')
  end

  def pro_plan
    ensure_plans_exist
    Plan.find_by(name: 'pro')
  end

  def enterprise_plan
    ensure_plans_exist
    Plan.find_by(name: 'enterprise')
  end
end