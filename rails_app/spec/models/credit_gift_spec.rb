# frozen_string_literal: true

# == Schema Information
#
# Table name: credit_gifts
#
#  id                :bigint           not null, primary key
#  amount            :integer          not null
#  credits_allocated :boolean          default(FALSE), not null
#  notes             :text
#  reason            :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#  admin_id          :bigint           not null
#
# Indexes
#
#  index_credit_gifts_on_account_id                 (account_id)
#  index_credit_gifts_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_gifts_on_admin_id                   (admin_id)
#  index_credit_gifts_on_credits_allocated          (credits_allocated)
#
require "rails_helper"

RSpec.describe CreditGift, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:account) }
    it { is_expected.to belong_to(:admin).class_name("User") }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:amount) }
    it { is_expected.to validate_numericality_of(:amount).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:reason) }
    it { is_expected.to validate_inclusion_of(:reason).in_array(CreditGift::REASONS) }
  end

  describe "REASONS constant" do
    it "includes expected reasons" do
      expect(CreditGift::REASONS).to include(
        "customer_support",
        "promotional",
        "compensation",
        "beta_testing",
        "referral_bonus",
        "other"
      )
    end
  end

  describe "factory" do
    it "creates a valid credit gift" do
      gift = build(:credit_gift)
      expect(gift).to be_valid
    end
  end
end
