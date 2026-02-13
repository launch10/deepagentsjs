# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::AllocatePackCreditsWorker do
  let(:account) { create(:account, :subscribed) }
  let(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999) }

  let(:payment_processor) { account.payment_processor }

  let(:charge) do
    payment_processor.charges.create!(
      processor_id: "ch_#{SecureRandom.hex(8)}",
      amount: credit_pack.price_cents,
      amount_refunded: 0,
      metadata: {credit_pack_id: credit_pack.id}
    )
  end

  let(:worker) { described_class.new }

  describe "#perform" do
    it "allocates pack credits to the account" do
      expect {
        worker.perform(charge.id, credit_pack.id)
      }.to change { CreditTransaction.count }.by(1)

      transaction = CreditTransaction.last
      expect(transaction.transaction_type).to eq("purchase")
      expect(transaction.credit_type).to eq("pack")
      expect(transaction.reason).to eq("pack_purchase")
      expect(transaction.amount).to eq(1000)

      account.reload
      expect(account.pack_credits).to eq(1000)
    end

    it "creates a CreditPackPurchase record" do
      expect {
        worker.perform(charge.id, credit_pack.id)
      }.to change { CreditPackPurchase.count }.by(1)

      purchase = CreditPackPurchase.last
      expect(purchase.account).to eq(account)
      expect(purchase.credit_pack).to eq(credit_pack)
      expect(purchase.pay_charge).to eq(charge)
      expect(purchase.credits_purchased).to eq(1000)
    end

    it "generates correct idempotency key format" do
      worker.perform(charge.id, credit_pack.id)

      transaction = CreditTransaction.last
      expect(transaction.idempotency_key).to eq("pack_purchase:#{charge.id}")
    end

    it "is idempotent - second call does nothing" do
      worker.perform(charge.id, credit_pack.id)
      expect(CreditTransaction.count).to eq(1)
      expect(CreditPackPurchase.count).to eq(1)

      expect {
        worker.perform(charge.id, credit_pack.id)
      }.not_to change { CreditTransaction.count }

      expect(CreditPackPurchase.count).to eq(1)
    end

    it "handles charge not found gracefully" do
      expect {
        worker.perform(999_999, credit_pack.id)
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "handles credit pack not found gracefully" do
      expect {
        worker.perform(charge.id, 999_999)
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    context "when owner is not an Account" do
      it "does not allocate credits when owner check fails" do
        # Create the charge first
        charge_to_test = charge

        # Now mock the customer.owner to return nil (simulating non-Account owner)
        allow(charge_to_test).to receive_message_chain(:customer, :owner).and_return(nil)
        allow(Pay::Charge).to receive(:find).with(charge_to_test.id).and_return(charge_to_test)

        expect {
          worker.perform(charge_to_test.id, credit_pack.id)
        }.not_to change { CreditTransaction.count }
      end
    end

    it "tracks credit_pack_purchased" do
      expect(TrackEvent).to receive(:call).with("credit_pack_purchased",
        hash_including(
          pack_credits: credit_pack.credits,
          pack_price_cents: charge.amount
        )
      )
      worker.perform(charge.id, credit_pack.id)
    end

    context "with existing pack credits" do
      before do
        # Create proper transaction history to establish balances (500 credits = 500,000 millicredits)
        account.credit_transactions.create!(
          transaction_type: "purchase",
          credit_type: "pack",
          reason: "pack_purchase",
          amount_millicredits: 500_000,
          balance_after_millicredits: 500_000,
          plan_balance_after_millicredits: 0,
          pack_balance_after_millicredits: 500_000,
          skip_sequence_validation: true
        )
        account.update!(pack_millicredits: 500_000, total_millicredits: 500_000)
      end

      it "adds to existing pack credits" do
        worker.perform(charge.id, credit_pack.id)

        account.reload
        expect(account.pack_credits).to eq(1500)
        expect(account.total_credits).to eq(1500)
      end
    end
  end
end
