# frozen_string_literal: true

# Handles initial credit allocation when a subscription is created.
#
# IMPORTANT: This concern only handles initial allocation (on: :create).
# Renewals and plan changes are handled by webhook handlers:
#   - Credits::RenewalHandler (stripe.invoice.paid with billing_reason == "subscription_cycle")
#   - Credits::PlanChangeHandler (stripe.customer.subscription.updated with previous_attributes.items)
#
# See plans/billing/stripe_webhook_testing_strategy.md for details on why we use
# webhooks instead of ActiveRecord callbacks for renewals and plan changes.
#
module PaySubscriptionCredits
  extend ActiveSupport::Concern

  included do
    # Initial allocation only - deterministic, fires once when subscription is created
    # This works for both:
    # - Stripe subscriptions (created when Pay syncs the subscription from webhook)
    # - Fake processor subscriptions (created directly in tests)
    after_commit :handle_subscription_created, on: :create
  end

  private

  def handle_subscription_created
    return unless should_allocate_credits?

    account = customer&.owner
    if account.is_a?(Account)
      plan = Plan.find_by(stripe_id: processor_plan)
      TrackEvent.call("subscription_started",
        user: account.owner,
        account: account,
        plan_name: plan&.name,
        plan_interval: plan&.interval,
        plan_amount_cents: plan&.amount,
        time_since_signup_hours: account.owner ? ((Time.current - account.owner.created_at) / 1.hour).round : nil
      )
    end

    Credits::ResetPlanCreditsWorker.perform_async(id)
  end

  def should_allocate_credits?
    return false unless customer&.owner.is_a?(Account)
    return false unless active?
    true
  end
end
