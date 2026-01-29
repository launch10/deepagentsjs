# == Schema Information
#
# Table name: dashboard_insights
#
#  id              :bigint           not null, primary key
#  generated_at    :datetime         not null
#  insights        :jsonb            not null
#  metrics_summary :jsonb
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  account_id      :bigint           not null
#
# Indexes
#
#  index_dashboard_insights_on_account_id  (account_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#
require "rails_helper"

RSpec.describe DashboardInsight, type: :model do
  describe "associations" do
    it { should belong_to(:account) }
  end

  describe "validations" do
    it { should validate_presence_of(:account) }
    it { should validate_presence_of(:insights) }
    it { should validate_presence_of(:generated_at) }
  end

  # Core user outcome: caching works - insights aren't regenerated unnecessarily
  describe "freshness detection" do
    let(:account) { create(:account) }

    describe "#fresh?" do
      it "returns true when generated within 24 hours" do
        insight = build(:dashboard_insight, account: account, generated_at: 23.hours.ago)
        expect(insight.fresh?).to be true
      end

      it "returns false when generated more than 24 hours ago" do
        insight = build(:dashboard_insight, account: account, generated_at: 25.hours.ago)
        expect(insight.fresh?).to be false
      end

      it "returns true when just generated" do
        insight = build(:dashboard_insight, account: account, generated_at: 1.minute.ago)
        expect(insight.fresh?).to be true
      end
    end

    describe "#stale?" do
      it "is the inverse of fresh?" do
        fresh = build(:dashboard_insight, account: account, generated_at: 1.hour.ago)
        stale = build(:dashboard_insight, account: account, generated_at: 25.hours.ago)

        expect(fresh.stale?).to be false
        expect(stale.stale?).to be true
      end
    end
  end

  # Core user outcome: one insight record per account
  describe "uniqueness" do
    let(:account) { create(:account) }

    it "enforces one record per account at database level" do
      create(:dashboard_insight, account: account)
      duplicate = build(:dashboard_insight, account: account)

      # Database constraint should prevent save
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end
end
