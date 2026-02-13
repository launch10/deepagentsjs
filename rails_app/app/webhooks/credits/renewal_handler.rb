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

      # Extract subscription ID from the invoice
      # Stripe API 2025-12-15.clover moved subscription to parent.subscription_details.subscription
      subscription_id = extract_subscription_id(invoice)

      # Only process subscription invoices
      return unless subscription_id

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
        .find_by(pay_customers: {processor: "stripe"}, processor_id: subscription_id)

      # Gracefully handle edge cases - don't raise errors in webhooks
      return unless subscription
      return unless subscription.active?

      account = subscription.customer&.owner
      return unless account.is_a?(Account)

      plan = Plan.find_by(stripe_id: subscription.processor_plan)
      TrackEvent.call("subscription_renewed",
        user: account.owner,
        account: account,
        plan_name: plan&.name,
        plan_amount_cents: plan&.amount,
        months_subscribed: subscription.created_at ? ((Time.current - subscription.created_at) / 1.month).round : nil,
        credits_used_this_period: account.credits_used)

      # Use Stripe event ID for idempotency (globally unique)
      Credits::ResetPlanCreditsWorker.perform_async(
        subscription.id,
        {"stripe_event_id" => event.id}
      )
    end

    private

    # Extract subscription ID from invoice, handling different Stripe API versions
    # Stripe API 2025-12-15.clover moved subscription from direct property
    # to parent.subscription_details.subscription
    def extract_subscription_id(invoice)
      # Try new API structure first (2025-12-15.clover and later)
      if invoice.respond_to?(:parent) && invoice.parent
        parent = invoice.parent
        parent_hash = parent.respond_to?(:to_hash) ? parent.to_hash : parent
        parent_hash.with_indifferent_access.dig(:subscription_details, :subscription)
      end || invoice.try(:subscription)
    end
  end
end
