# == Schema Information
#
# Table name: credit_pack_purchases
#
#  id                :bigint           not null, primary key
#  credits_purchased :integer          not null
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
    it { is_expected.to validate_presence_of(:price_cents) }
    it { is_expected.to validate_numericality_of(:credits_purchased).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:price_cents).is_greater_than(0) }
  end

  describe "scopes" do
    let(:account) { create(:account) }

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

  describe "#mark_used!" do
    let(:purchase) { create(:credit_pack_purchase, is_used: false) }

    it "sets is_used to true" do
      purchase.mark_used!
      expect(purchase.reload).to be_is_used
    end
  end
end
