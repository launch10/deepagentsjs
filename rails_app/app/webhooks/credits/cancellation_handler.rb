# frozen_string_literal: true

module Credits
  # Handles customer.subscription.deleted webhooks for subscription cancellations.
  #
  # When a subscription ends (either at period end or immediately), Stripe fires
  # this event. We intentionally do NOT expire plan credits here — the user has
  # already paid for the current period and retains their remaining balance.
  #
  # Protection against new credit grants is handled elsewhere:
  # - RenewalHandler skips inactive subscriptions (no new monthly allocations)
  # - DailyReconciliationWorker excludes subscriptions with ends_at set
  #   (no monthly resets for yearly subscribers pending cancellation)
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.deleted", Credits::CancellationHandler.new
  #
  class CancellationHandler
    def call(event)
      # No-op for credits. The subscription is ending, but we don't expire
      # plan credits. The user keeps their remaining balance.
      #
      # New credit grants are prevented by:
      # 1. RenewalHandler checks subscription.active? (canceled subs are skipped)
      # 2. DailyReconciliationWorker excludes subs with ends_at set
    end
  end
end
