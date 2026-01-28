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
          prefix_id: InertiaSchemas.string_field(description: 'Subscription prefix ID for API calls'),
          status: InertiaSchemas.string_field(description: 'Subscription status'),
          plan_name: InertiaSchemas.string_field(description: 'Plan name'),
          plan_display_name: InertiaSchemas.string_field(description: 'Human-readable plan name'),
          interval: InertiaSchemas.string_field(description: 'Billing interval (month or year)'),
          amount_cents: InertiaSchemas.integer_field(description: 'Plan price in cents'),
          currency: InertiaSchemas.string_field(description: 'Currency code'),
          current_period_start: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Current billing period start')),
          current_period_end: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Current billing period end')),
          ends_at: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'When subscription ends (if canceled)')),
          features: { type: :array, items: { type: :string }, description: 'Plan features' }
        },
        required: %w[id prefix_id status plan_name plan_display_name interval amount_cents currency features]
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

    def self.credit_pack_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          id: InertiaSchemas.integer_field(description: 'Credit pack ID'),
          name: InertiaSchemas.string_field(description: 'Credit pack name'),
          credits: InertiaSchemas.integer_field(description: 'Number of credits in pack'),
          price_cents: InertiaSchemas.integer_field(description: 'Price in cents'),
          stripe_price_id: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Stripe price ID'))
        },
        required: %w[id name credits price_cents]
      }
    end

    def self.payment_method_props
      InertiaSchemas.nullable(
        type: :object,
        additionalProperties: false,
        properties: {
          type: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Payment method type (card, link, affirm, etc.)')),
          brand: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Card brand (Visa, Mastercard, etc.)')),
          last4: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Last 4 digits of card or account')),
          exp_month: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Card expiration month')),
          exp_year: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Card expiration year')),
          email: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Email for Link or PayPal payment methods'))
        },
        required: []
      )
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
        stripe_portal_url: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'URL to Stripe customer portal')),
        credit_packs: {
          type: :array,
          items: credit_pack_props,
          description: 'Available credit packs for purchase'
        },
        payment_method: payment_method_props
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
