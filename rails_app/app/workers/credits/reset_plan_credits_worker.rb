# frozen_string_literal: true

module Credits
  class ResetPlanCreditsWorker < ApplicationWorker
    def perform(subscription_id)
      subscription = Pay::Subscription.find(subscription_id)
      return unless subscription.active?

      account = subscription.customer.owner
      idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"

      return if CreditTransaction.exists?(idempotency_key: idempotency_key)

      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key
      )
    end
  end
end
