# frozen_string_literal: true

module Credits
  class ResetPlanCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    # Unified worker for all credit reset scenarios:
    # - Initial allocation (subscription created)
    # - Renewals (invoice.paid webhook with billing_reason: subscription_cycle)
    # - Plan changes (subscription.updated webhook with previous_attributes.items)
    # - Monthly resets for yearly subscribers (daily reconciliation job)
    #
    # Options:
    #   stripe_event_id: Stripe event ID for webhook-triggered resets (best idempotency)
    #   previous_plan_id: Plan ID for upgrade/downgrade detection
    #   monthly_reset: true for yearly subscriber monthly resets
    #
    def perform(subscription_id, options = {})
      options = options.transform_keys(&:to_sym) if options.is_a?(Hash)

      subscription = Pay::Subscription.find(subscription_id)
      return unless subscription.active?

      account = subscription.customer.owner
      return unless account.is_a?(Account)

      # Monthly reset for yearly subscribers - different idempotency strategy
      if options[:monthly_reset]
        return unless subscription.plan&.yearly?
        idempotency_key = "monthly_reset:#{subscription.id}:#{Time.current.to_date.beginning_of_month.iso8601}"
        previous_plan = nil
      else
        idempotency_key = build_idempotency_key(subscription, options)
        previous_plan = options[:previous_plan_id].present? ? Plan.find_by(id: options[:previous_plan_id]) : nil
      end

      # Note: Idempotency is checked inside the transaction with proper locking
      # Do not add a check here - it would be racey and redundant

      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key,
        previous_plan: previous_plan
      )
    end

    private

    # Idempotency key format depends on source:
    # - Stripe webhook: plan_credits:{event_id} (globally unique, never collides)
    # - Plan change: plan_change:{sub_id}:{old}:{new}
    # - Renewal/initial: plan_credits:{sub_id}:{period_start_date}
    def build_idempotency_key(subscription, options)
      if options[:stripe_event_id].present?
        "plan_credits:#{options[:stripe_event_id]}"
      elsif options[:previous_plan_id].present?
        "plan_change:#{subscription.id}:#{options[:previous_plan_id]}:#{subscription.processor_plan}"
      else
        period_start = subscription.current_period_start || Time.current
        "plan_credits:#{subscription.id}:#{period_start.to_date.iso8601}"
      end
    end
  end
end
