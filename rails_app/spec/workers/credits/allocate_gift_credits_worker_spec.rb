# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::AllocateGiftCreditsWorker do
  let(:account) { create(:account) }
  let(:admin) { create(:user, admin: true) }

  # Helper to create a gift without triggering the after_create callback
  def create_gift_without_callback(attrs = {})
    CreditGift.skip_callback(:create, :after, :enqueue_credit_allocation)
    gift = account.credit_gifts.create!(
      admin: admin,
      amount: attrs[:amount] || 500,
      reason: attrs[:reason] || "customer_support",
      notes: attrs[:notes]
    )
    CreditGift.set_callback(:create, :after, :enqueue_credit_allocation)
    gift
  end

  describe "#perform" do
    context "with valid gift" do
      it "allocates credits to the account" do
        gift = create_gift_without_callback(amount: 500, reason: "promotional")

        expect {
          described_class.new.perform(gift.id)
        }.to change { account.reload.pack_credits }.from(0).to(500)
      end

      it "marks credits_allocated: true" do
        gift = create_gift_without_callback(amount: 500, reason: "promotional")
        expect(gift.credits_allocated).to eq(false)

        described_class.new.perform(gift.id)

        expect(gift.reload.credits_allocated).to eq(true)
      end

      it "creates a CreditTransaction" do
        gift = create_gift_without_callback(amount: 500, reason: "promotional")

        expect {
          described_class.new.perform(gift.id)
        }.to change { CreditTransaction.count }.by(1)

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("gift")
        expect(transaction.credit_type).to eq("pack")
        expect(transaction.amount).to eq(500)
        expect(transaction.reference_type).to eq("CreditGift")
        expect(transaction.reference_id).to eq(gift.id.to_s)
      end
    end

    context "idempotency" do
      it "skips if gift is already allocated" do
        gift = create_gift_without_callback(amount: 500, reason: "promotional")

        # First run
        described_class.new.perform(gift.id)
        expect(account.reload.pack_credits).to eq(500)

        # Second run - should be idempotent
        expect {
          described_class.new.perform(gift.id)
        }.not_to change { account.reload.pack_credits }
      end

      it "does not create duplicate transactions" do
        gift = create_gift_without_callback(amount: 500, reason: "promotional")

        described_class.new.perform(gift.id)
        expect(CreditTransaction.count).to eq(1)

        described_class.new.perform(gift.id)
        expect(CreditTransaction.count).to eq(1)
      end
    end

    context "when gift is not found" do
      it "raises ActiveRecord::RecordNotFound" do
        expect {
          described_class.new.perform(99999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end

  describe "CreditGift after_create callback" do
    it "enqueues the worker when a gift is created" do
      expect(Credits::AllocateGiftCreditsWorker).to receive(:perform_async).with(kind_of(Integer))

      account.credit_gifts.create!(
        admin: admin,
        amount: 500,
        reason: "promotional"
      )
    end
  end

  describe "full integration" do
    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    it "creates gift and allocates credits in one flow" do
      expect(account.pack_credits).to eq(0)

      gift = account.credit_gifts.create!(
        admin: admin,
        amount: 500,
        reason: "customer_support",
        notes: "Compensation for issue"
      )

      account.reload
      expect(account.pack_credits).to eq(500)
      expect(gift.reload.credits_allocated).to eq(true)
    end
  end
end
