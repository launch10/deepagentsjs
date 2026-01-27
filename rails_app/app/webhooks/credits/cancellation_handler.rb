# frozen_string_literal: true

module Credits
  # Handles customer.subscription.deleted webhooks for subscription cancellations.
  #
  # When a subscription ends (either at period end or immediately), Stripe fires
  # this event. We expire any remaining plan credits, while preserving pack credits.
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.deleted", Credits::CancellationHandler.new
  #
  class CancellationHandler
    def call(event)
      subscription_object = event.data.object

      subscription = Pay::Subscription
        .joins(:customer)
        .find_by(pay_customers: {processor: "stripe"}, processor_id: subscription_object.id)

      # Gracefully handle edge cases - don't raise errors in webhooks
      return unless subscription

      account = subscription.customer&.owner
      return unless account.is_a?(Account)

      # Expire any remaining plan credits
      Credits::ConsumptionService.new(account).expire_plan_credits!(
        reason: :plan_credits_expired,
        idempotency_key: "cancellation_expire:#{event.id}"
      )
    end
  end
end
