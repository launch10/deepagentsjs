# frozen_string_literal: true

module Credits
  # Handles invoice.paid webhooks for subscription renewals.
  #
  # Only processes events where billing_reason == "subscription_cycle",
  # which indicates an actual renewal payment (not first payment, proration, etc.)
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.invoice.paid", Credits::RenewalHandler.new
  #
  class RenewalHandler
    def call(event)
      invoice = event.data.object

      # Only process subscription invoices
      return unless invoice.subscription

      # Only process actual renewals (not first payment, proration, manual, etc.)
      # billing_reason values:
      #   - "subscription_create" : First invoice for new subscription
      #   - "subscription_cycle"  : Renewal payment (THIS IS WHAT WE WANT)
      #   - "subscription_update" : Proration from plan change
      #   - "subscription_threshold" : Usage-based billing threshold
      #   - "manual" : Manually created invoice
      return unless invoice.billing_reason == "subscription_cycle"

      subscription = Pay::Subscription
        .joins(:customer)
        .find_by(pay_customers: {processor: "stripe"}, processor_id: invoice.subscription)

      raise "Subscription not found for processor_id: #{invoice.subscription}" unless subscription
      raise "Subscription #{subscription.id} is not active" unless subscription.active?

      account = subscription.customer&.owner
      raise "Account not found for subscription #{subscription.id}" unless account.is_a?(Account)
      # Use Stripe event ID for idempotency (globally unique)
      Credits::ResetPlanCreditsWorker.perform_async(
        subscription.id,
        {"stripe_event_id" => event.id}
      )
    end
  end
end
