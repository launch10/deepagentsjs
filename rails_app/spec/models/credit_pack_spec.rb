# == Schema Information
#
# Table name: credit_packs
#
#  id              :bigint           not null, primary key
#  credits         :integer          not null
#  currency        :string           default("usd")
#  name            :string           not null
#  price_cents     :integer          not null
#  visible         :boolean          default(TRUE)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  stripe_price_id :string
#
# Indexes
#
#  index_credit_packs_on_name  (name) UNIQUE
#
require "rails_helper"

RSpec.describe CreditPack, type: :model do
  describe "associations" do
    it { is_expected.to have_many(:credit_pack_purchases) }
  end

  describe "validations" do
    subject { build(:credit_pack) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:credits) }
    it { is_expected.to validate_presence_of(:price_cents) }
    it { is_expected.to validate_uniqueness_of(:name) }
    it { is_expected.to validate_numericality_of(:credits).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:price_cents).is_greater_than(0) }
  end

  describe "scopes" do
    describe ".visible" do
      let!(:visible_pack) { create(:credit_pack, visible: true) }
      let!(:hidden_pack) { create(:credit_pack, visible: false) }

      it "returns only visible packs" do
        expect(described_class.visible).to contain_exactly(visible_pack)
      end
    end

    describe ".by_credits" do
      let!(:small) { create(:credit_pack, credits: 500) }
      let!(:big) { create(:credit_pack, credits: 3000) }
      let!(:mid) { create(:credit_pack, credits: 1250) }

      it "orders by credits ascending" do
        expect(described_class.by_credits).to eq([small, mid, big])
      end
    end
  end

  describe "#price_dollars" do
    it "converts cents to dollars" do
      pack = build(:credit_pack, price_cents: 2500)
      expect(pack.price_dollars).to eq(25.0)
    end
  end

  describe "#credits_per_dollar" do
    it "calculates credits per dollar" do
      pack = build(:credit_pack, credits: 500, price_cents: 2500)
      expect(pack.credits_per_dollar).to eq(20.0)
    end
  end
end
