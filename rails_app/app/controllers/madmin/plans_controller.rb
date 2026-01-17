module Madmin
  class PlansController < Madmin::ResourceController
    def index
      @plans = ::Plan.order(amount: :asc)

      render inertia: "Madmin/Plans/Index",
        props: {
          plans: @plans.map { |p| serialize_plan(p) }
        }
    end

    def show
      @plan = ::Plan.find(params[:id])

      render inertia: "Madmin/Plans/Show",
        props: {
          plan: serialize_plan(@plan, detailed: true)
        }
    end

    private

    # Add support for features array
    def resource_params
      params.require(resource.param_key)
        .permit(*resource.permitted_params, features: [])
        .with_defaults(features: [])
        .transform_values { |v| change_polymorphic(v) }
    end

    def serialize_plan(plan, detailed: false)
      data = {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        intervalCount: plan.interval_count,
        hidden: plan.hidden?,
        trialPeriodDays: plan.trial_period_days,
        createdAt: plan.created_at&.iso8601
      }

      if detailed
        data.merge!(
          description: plan.description,
          features: plan.features,
          chargePerUnit: plan.charge_per_unit?,
          unitLabel: plan.unit_label,
          contactUrl: plan.contact_url,
          stripeId: plan.stripe_id,
          updatedAt: plan.updated_at&.iso8601
        )
      end

      data
    end
  end
end
