# == Schema Information
#
# Table name: credit_pack_purchases
#
#  id                :bigint           not null, primary key
#  credits_allocated :boolean          default(FALSE), not null
#  credits_purchased :integer          not null
#  credits_used      :integer          default(0), not null
#  is_used           :boolean          default(FALSE), not null
#  price_cents       :integer          not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#  credit_pack_id    :bigint           not null
#  pay_charge_id     :bigint
#
# Indexes
#
#  index_credit_pack_purchases_on_account_id                 (account_id)
#  index_credit_pack_purchases_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_pack_purchases_on_account_id_and_is_used     (account_id,is_used)
#  index_credit_pack_purchases_on_credit_pack_id             (credit_pack_id)
#  index_credit_pack_purchases_on_credits_allocated          (credits_allocated)
#  index_credit_pack_purchases_on_pay_charge_id              (pay_charge_id)
#
require "rails_helper"

RSpec.describe CreditPackPurchase, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:account) }
    it { is_expected.to belong_to(:credit_pack) }
    it { is_expected.to belong_to(:pay_charge).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:credits_purchased) }
    it { is_expected.to validate_presence_of(:credits_used) }
    it { is_expected.to validate_presence_of(:price_cents) }
    it { is_expected.to validate_numericality_of(:credits_purchased).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:credits_used).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:price_cents).is_greater_than(0) }

    describe "credits_used_not_exceeding_purchased" do
      let(:subscribed_account) { create(:account, :subscribed) }
      let(:credit_pack) { create(:credit_pack) }
      let(:purchase) do
        build(:credit_pack_purchase,
          account: subscribed_account,
          credit_pack: credit_pack,
          credits_purchased: 500,
          credits_used: 600)
      end

      it "is invalid when credits_used exceeds credits_purchased" do
        expect(purchase).not_to be_valid
        expect(purchase.errors[:credits_used]).to include("cannot exceed credits_purchased")
      end

      it "is valid when credits_used equals credits_purchased" do
        purchase.credits_used = 500
        expect(purchase).to be_valid
      end

      it "is valid when credits_used is less than credits_purchased" do
        purchase.credits_used = 250
        expect(purchase).to be_valid
      end
    end

    describe "account_has_active_subscription" do
      let(:account_without_subscription) { create(:account) }
      let(:account_with_subscription) { create(:account, :subscribed) }
      let(:credit_pack) { create(:credit_pack) }

      it "is invalid when account has no active subscription" do
        purchase = build(:credit_pack_purchase,
          account: account_without_subscription,
          credit_pack: credit_pack)

        expect(purchase).not_to be_valid
        expect(purchase.errors[:base]).to include("Account must have an active subscription to purchase credit packs")
      end

      it "is valid when account has an active subscription" do
        purchase = build(:credit_pack_purchase,
          account: account_with_subscription,
          credit_pack: credit_pack)

        expect(purchase).to be_valid
      end

      it "is invalid when subscription is canceled" do
        account = create(:account, :subscribed)
        account.subscriptions.active.first.update!(status: "canceled")

        purchase = build(:credit_pack_purchase,
          account: account,
          credit_pack: credit_pack)

        expect(purchase).not_to be_valid
        expect(purchase.errors[:base]).to include("Account must have an active subscription to purchase credit packs")
      end

      it "does not validate subscription on update" do
        # Create with subscription
        purchase = create(:credit_pack_purchase, account: account_with_subscription)

        # Cancel subscription after purchase
        account_with_subscription.subscriptions.active.first.update!(status: "canceled")

        # Should still be able to update the purchase
        purchase.credits_used = 100
        expect(purchase).to be_valid
        expect(purchase.save).to be true
      end
    end
  end

  describe "scopes" do
    let(:account) { create(:account, :subscribed) }

    describe ".unused" do
      let!(:unused) { create(:credit_pack_purchase, account: account, is_used: false) }
      let!(:used) { create(:credit_pack_purchase, account: account, is_used: true) }

      it "returns only unused purchases" do
        expect(described_class.unused).to contain_exactly(unused)
      end
    end

    describe ".used" do
      let!(:unused) { create(:credit_pack_purchase, account: account, is_used: false) }
      let!(:used) { create(:credit_pack_purchase, account: account, is_used: true) }

      it "returns only used purchases" do
        expect(described_class.used).to contain_exactly(used)
      end
    end

    describe ".for_account" do
      let!(:mine) { create(:credit_pack_purchase, account: account) }
      let!(:other) { create(:credit_pack_purchase) }

      it "filters by account" do
        expect(described_class.for_account(account)).to contain_exactly(mine)
      end
    end

    describe ".oldest_first" do
      let!(:newer) { create(:credit_pack_purchase, account: account, created_at: 1.day.ago) }
      let!(:older) { create(:credit_pack_purchase, account: account, created_at: 2.days.ago) }

      it "orders by created_at ascending" do
        expect(described_class.oldest_first).to eq([older, newer])
      end
    end
  end

  describe "#credits_remaining" do
    let(:purchase) { create(:credit_pack_purchase, credits_purchased: 500, credits_used: 200) }

    it "returns credits_purchased minus credits_used" do
      expect(purchase.credits_remaining).to eq(300)
    end
  end

  describe "#fully_consumed?" do
    it "returns true when credits_used equals credits_purchased" do
      purchase = create(:credit_pack_purchase, credits_purchased: 500, credits_used: 500)
      expect(purchase).to be_fully_consumed
    end

    it "returns false when credits_used is less than credits_purchased" do
      purchase = create(:credit_pack_purchase, credits_purchased: 500, credits_used: 250)
      expect(purchase).not_to be_fully_consumed
    end
  end

  describe "#mark_used!" do
    let(:purchase) { create(:credit_pack_purchase, is_used: false) }

    it "sets is_used to true" do
      purchase.mark_used!
      expect(purchase.reload).to be_is_used
    end
  end
end
