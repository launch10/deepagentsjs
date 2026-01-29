# frozen_string_literal: true

module Credits
  class AdjustUsageCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    # Adjusts usage credits when an admin creates a CreditUsageAdjustment.
    #
    # This worker is triggered by CreditUsageAdjustment after_create callback.
    #
    # @param credit_usage_adjustment_id [Integer] CreditUsageAdjustment ID
    #
    def perform(credit_usage_adjustment_id)
      adjustment = CreditUsageAdjustment.find(credit_usage_adjustment_id)

      # Idempotency: skip if already adjusted
      return if adjustment.credits_adjusted?

      Credits::AllocationService.new(adjustment.account).adjust_usage!(
        millicredits: Millicredits.from_credits(adjustment.amount),
        reason: adjustment.reason,
        admin: adjustment.admin,
        notes: adjustment.notes,
        idempotency_key: "usage_adjustment:#{adjustment.id}"
      )

      adjustment.update!(credits_adjusted: true)
    end
  end
end
