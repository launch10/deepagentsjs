# frozen_string_literal: true

module Credits
  class AllocateGiftCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    # Allocates gift credits when an admin creates a CreditGift.
    #
    # This worker is triggered by CreditGift after_create callback.
    #
    # @param credit_gift_id [Integer] CreditGift ID
    #
    def perform(credit_gift_id)
      gift = CreditGift.find(credit_gift_id)

      # Idempotency: skip if already allocated
      return if gift.credits_allocated?

      Credits::AllocationService.new(gift.account).allocate_gift!(
        gift: gift,
        idempotency_key: "gift:#{gift.id}"
      )
    end
  end
end
