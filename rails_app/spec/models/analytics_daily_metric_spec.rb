# == Schema Information
#
# Table name: analytics_daily_metrics
#
#  id                     :bigint           not null, primary key
#  clicks                 :bigint           default(0), not null
#  conversion_value_cents :bigint           default(0), not null
#  cost_micros            :bigint           default(0), not null
#  date                   :date             not null
#  deleted_at             :datetime
#  impressions            :bigint           default(0), not null
#  leads_count            :integer          default(0), not null
#  page_views_count       :bigint           default(0), not null
#  unique_visitors_count  :bigint           default(0), not null
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  account_id             :bigint           not null
#  project_id             :bigint           not null
#
# Indexes
#
#  idx_analytics_daily_acct_date                (account_id,date)
#  idx_analytics_daily_acct_proj_date           (account_id,project_id,date) UNIQUE
#  idx_analytics_daily_proj_date                (project_id,date)
#  index_analytics_daily_metrics_on_deleted_at  (deleted_at)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (project_id => projects.id)
#
require "rails_helper"

RSpec.describe AnalyticsDailyMetric, type: :model do
  describe "associations" do
    it { should belong_to(:account) }
    it { should belong_to(:project) }
  end

  describe "validations" do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    subject { build(:analytics_daily_metric, account: account, project: project) }

    it { should validate_presence_of(:account_id) }
    it { should validate_presence_of(:project_id) }
    it { should validate_presence_of(:date) }
    it { should validate_uniqueness_of(:date).scoped_to([:account_id, :project_id]) }
  end

  # Core user outcome: idempotent upserts work correctly for daily computation
  describe "uniqueness constraint for upserts" do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }

    it "prevents duplicate records for same account+project+date" do
      create(:analytics_daily_metric, account: account, project: project, date: Date.yesterday)
      duplicate = build(:analytics_daily_metric, account: account, project: project, date: Date.yesterday)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:date]).to include("has already been taken")
    end

    it "allows same date for different projects" do
      project2 = create(:project, account: account)
      create(:analytics_daily_metric, account: account, project: project, date: Date.yesterday)
      record2 = build(:analytics_daily_metric, account: account, project: project2, date: Date.yesterday)
      expect(record2).to be_valid
    end
  end

  describe "scopes" do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }

    describe ".for_date_range" do
      let!(:in_range) { create(:analytics_daily_metric, account: account, project: project, date: 5.days.ago) }
      let!(:out_of_range) { create(:analytics_daily_metric, account: account, project: project, date: 30.days.ago) }

      it "returns metrics within the range" do
        results = described_class.for_date_range(7.days.ago, Date.current)
        expect(results).to include(in_range)
        expect(results).not_to include(out_of_range)
      end
    end

    describe ".for_account" do
      let(:other_account) { create(:account) }
      let(:other_project) { create(:project, account: other_account) }
      let!(:mine) { create(:analytics_daily_metric, account: account, project: project, date: 1.day.ago) }
      let!(:theirs) { create(:analytics_daily_metric, account: other_account, project: other_project, date: 2.days.ago) }

      it "returns metrics for the specified account only" do
        results = described_class.for_account(account)
        expect(results).to include(mine)
        expect(results).not_to include(theirs)
      end
    end
  end

  # Core user outcome: computed metrics for dashboard display are correct
  describe "computed metrics" do
    let(:metric) do
      build(:analytics_daily_metric,
        clicks: 100,
        impressions: 1000,
        cost_micros: 50_000_000,
        leads_count: 10)
    end

    describe "#ctr" do
      it "calculates click-through rate" do
        expect(metric.ctr).to eq(0.10) # 100/1000
      end

      it "returns nil when impressions is zero" do
        metric.impressions = 0
        expect(metric.ctr).to be_nil
      end
    end

    describe "#cpl_dollars" do
      it "calculates cost per lead in dollars" do
        expect(metric.cpl_dollars).to eq(5.0) # $50 / 10 leads
      end

      it "returns nil when leads_count is zero" do
        metric.leads_count = 0
        expect(metric.cpl_dollars).to be_nil
      end
    end

    describe "#cost_dollars" do
      it "converts micros to dollars" do
        expect(metric.cost_dollars).to eq(50.0)
      end
    end
  end
end
