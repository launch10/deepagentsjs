# frozen_string_literal: true

module Credits
  class AllocatePackCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    # Allocates pack credits when a credit pack is purchased.
    #
    # This worker is triggered by ChargeExtensions when a Pay::Charge is created
    # with credit_pack_id in the metadata.
    #
    # @param charge_id [Integer] Pay::Charge ID
    # @param credit_pack_id [Integer] CreditPack ID
    #
    def perform(charge_id, credit_pack_id)
      charge = Pay::Charge.find(charge_id)
      credit_pack = CreditPack.find(credit_pack_id)

      account = charge.customer.owner
      return unless account.is_a?(Account)

      # Note: Idempotency is checked inside the transaction with proper locking
      # Do not add a check here - it would be racey and redundant
      Credits::AllocationService.new(account).allocate_pack!(
        credit_pack: credit_pack,
        pay_charge: charge,
        idempotency_key: "pack_purchase:#{charge.id}"
      )

      TrackEvent.call("credit_pack_purchased",
        user: account.owner,
        account: account,
        pack_credits: credit_pack.credits,
        pack_price_cents: charge.amount,
        current_balance: account.reload.total_millicredits,
        plan_name: account.plan&.name
      )
    end
  end
end
