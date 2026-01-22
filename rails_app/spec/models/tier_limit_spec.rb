require "rails_helper"

RSpec.describe TierLimit, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  describe "validations" do
    subject { build(:tier_limit) }

    it { should validate_presence_of(:limit_type) }
    it { should validate_presence_of(:limit) }
    it { should validate_numericality_of(:limit).is_greater_than_or_equal_to(0) }
    it { should validate_uniqueness_of(:limit_type).scoped_to(:plan_tier_id) }
  end

  describe "associations" do
    it { should belong_to(:plan_tier).touch(true) }
  end

  describe "touching parent" do
    let(:tier) { create(:plan_tier) }
    let!(:limit) { create(:tier_limit, plan_tier: tier) }

    it "touches plan_tier when updated" do
      original_updated_at = tier.updated_at
      travel_to 1.minute.from_now do
        limit.update!(limit: limit.limit + 1000)
        expect(tier.reload.updated_at).to be > original_updated_at
      end
    end
  end
end
