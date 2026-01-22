# == Schema Information
#
# Table name: tier_limits
#
#  id         :bigint           not null, primary key
#  tier_id    :bigint
#  limit_type :string
#  limit      :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_tier_limits_on_created_at              (created_at)
#  index_tier_limits_on_limit                   (limit)
#  index_tier_limits_on_limit_type              (limit_type)
#  index_tier_limits_on_tier_id                 (tier_id)
#  index_tier_limits_on_tier_id_and_limit_type  (tier_id,limit_type) UNIQUE
#
require "rails_helper"

RSpec.describe TierLimit, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  describe "validations" do
    subject { build(:tier_limit) }

    it { should validate_presence_of(:limit_type) }
    it { should validate_presence_of(:limit) }
    it { should validate_numericality_of(:limit).is_greater_than_or_equal_to(0) }
    it { should validate_uniqueness_of(:limit_type).scoped_to(:tier_id) }
  end

  describe "associations" do
    it { should belong_to(:tier).class_name("PlanTier").touch(true) }
  end

  describe "touching parent" do
    let(:plan_tier) { create(:plan_tier) }
    let!(:limit) { create(:tier_limit, tier: plan_tier) }

    it "touches tier when updated" do
      original_updated_at = plan_tier.updated_at
      travel_to 1.minute.from_now do
        limit.update!(limit: limit.limit + 1000)
        expect(plan_tier.reload.updated_at).to be > original_updated_at
      end
    end
  end
end
