# frozen_string_literal: true

module Credits
  class ResetPlanCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    # Note: Sidekiq serializes keyword args as a hash, so we accept options hash
    def perform(subscription_id, options = {})
      # Handle both symbol and string keys (Sidekiq uses strings after serialization)
      options = options.transform_keys(&:to_sym) if options.is_a?(Hash)
      previous_plan_id = options[:previous_plan_id] if options.is_a?(Hash)
      stripe_event_id = options[:stripe_event_id] if options.is_a?(Hash)

      subscription = Pay::Subscription.find(subscription_id)
      return unless subscription.active?

      account = subscription.customer.owner
      return unless account.is_a?(Account)

      # Idempotency key format depends on source:
      # - Stripe webhook: plan_credits:{event_id} (globally unique, never collides)
      # - Callback/legacy: plan_credits:{sub_id}:{period_start_date} or plan_change:{sub_id}:{old}:{new}
      idempotency_key = if stripe_event_id.present?
        # Stripe event ID is globally unique - best idempotency key
        "plan_credits:#{stripe_event_id}"
      elsif previous_plan_id.present?
        # Plan change - one per old_plan -> new_plan transition
        "plan_change:#{subscription.id}:#{previous_plan_id}:#{subscription.processor_plan}"
      else
        # Renewal - one per billing period
        # Fall back to current date if period_start is nil (e.g., fake_processor in tests)
        period_start = subscription.current_period_start || Time.current
        "plan_credits:#{subscription.id}:#{period_start.to_date.iso8601}"
      end

      # Note: Idempotency is checked inside the transaction with proper locking
      # Do not add a check here - it would be racey and redundant

      previous_plan = previous_plan_id.present? ? Plan.find_by(id: previous_plan_id) : nil

      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key,
        previous_plan: previous_plan
      )
    end
  end
end
