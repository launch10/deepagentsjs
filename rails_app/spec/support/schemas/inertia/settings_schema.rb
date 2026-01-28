# frozen_string_literal: true

module InertiaSchemas
  module Settings
    def self.user_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          id: InertiaSchemas.integer_field(description: 'User ID'),
          email: InertiaSchemas.string_field(description: 'User email address'),
          name: InertiaSchemas.string_field(description: 'User full name'),
          first_name: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'User first name')),
          last_name: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'User last name'))
        },
        required: %w[id email name]
      }
    end

    def self.subscription_props
      InertiaSchemas.nullable(
        type: :object,
        additionalProperties: false,
        properties: {
          id: InertiaSchemas.integer_field(description: 'Subscription ID'),
          status: InertiaSchemas.string_field(description: 'Subscription status'),
          plan_name: InertiaSchemas.string_field(description: 'Plan name'),
          plan_display_name: InertiaSchemas.string_field(description: 'Human-readable plan name'),
          interval: InertiaSchemas.string_field(description: 'Billing interval (month or year)'),
          amount_cents: InertiaSchemas.integer_field(description: 'Plan price in cents'),
          currency: InertiaSchemas.string_field(description: 'Currency code'),
          current_period_start: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Current billing period start')),
          current_period_end: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Current billing period end')),
          features: { type: :array, items: { type: :string }, description: 'Plan features' }
        },
        required: %w[id status plan_name plan_display_name interval amount_cents currency features]
      )
    end

    def self.billing_history_item_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          id: InertiaSchemas.string_field(description: 'Charge processor ID'),
          amount_cents: InertiaSchemas.integer_field(description: 'Amount charged in cents'),
          currency: InertiaSchemas.string_field(description: 'Currency code'),
          description: InertiaSchemas.string_field(description: 'Charge description'),
          created_at: InertiaSchemas.string_field(description: 'When the charge was created'),
          type: InertiaSchemas.string_field(description: 'Charge type (charge, refund, subscription)')
        },
        required: %w[id amount_cents currency description created_at type]
      }
    end

    def self.page_props
      {
        user: user_props,
        subscription: subscription_props,
        billing_history: InertiaSchemas.nullable(
          type: :array,
          items: billing_history_item_props,
          description: 'Recent billing transactions'
        ),
        stripe_portal_url: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'URL to Stripe customer portal'))
      }
    end

    def self.page_required
      %w[user]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end
  end
end
