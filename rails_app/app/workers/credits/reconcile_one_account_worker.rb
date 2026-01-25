# frozen_string_literal: true

module Credits
  class ReconcileOneAccountWorker < ApplicationWorker
    sidekiq_options queue: :billing

    def perform(account_id)
      account = Account.find(account_id)
      subscription = account.payment_processor&.subscription

      return unless subscription&.active?
      return unless subscription.plan&.yearly?

      # For yearly subscriptions with monthly resets, we use a different
      # idempotency key based on current month, not period start
      reset_date = Time.current.to_date
      idempotency_key = "monthly_reset:#{subscription.id}:#{reset_date.beginning_of_month.iso8601}"

      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key
      )
    end
  end
end
