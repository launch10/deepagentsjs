# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::InsightsMetricsService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:dashboard_service) { Analytics::DashboardService.new(account, days: 30, status_filter: "all") }

  subject { described_class.new(dashboard_service) }

  before do
    Analytics::CacheService.clear_for_account(account.id)
    create(:analytics_daily_metric, account: account, project: project,
      date: 5.days.ago, leads_count: 10, page_views_count: 100, cost_micros: 50_000_000)
  end

  describe "#summary" do
    it "extracts totals for all metric types" do
      result = subject.summary
      expect(result[:totals]).to have_key(:leads)
      expect(result[:totals]).to have_key(:page_views)
      expect(result[:totals]).to have_key(:unique_visitors)
      expect(result[:totals]).to have_key(:ctr)
      expect(result[:totals]).to have_key(:cpl)
    end

    it "includes availability flags for ads metrics" do
      result = subject.summary
      expect(result[:totals]).to have_key(:ctr_available)
      expect(result[:totals]).to have_key(:cpl_available)
    end

    it "includes total spend in dollars" do
      result = subject.summary
      expect(result[:totals]).to have_key(:total_spend_dollars)
      expect(result[:totals][:total_spend_dollars]).to eq(50.0)
    end

    it "extracts project summaries" do
      result = subject.summary
      expect(result[:projects]).to be_an(Array)
      expect(result[:projects].first).to have_key(:uuid)
      expect(result[:projects].first).to have_key(:name)
    end

    it "includes days_since_last_lead in project summaries" do
      lead = create(:lead, account: account, email: "test@example.com")
      create(:website_lead, website: website, lead: lead, created_at: 3.days.ago)

      result = subject.summary
      expect(result[:projects].first).to have_key(:days_since_last_lead)
      expect(result[:projects].first[:days_since_last_lead]).to eq(3)
    end

    it "includes spend_dollars in project summaries" do
      result = subject.summary
      expect(result[:projects].first).to have_key(:spend_dollars)
      expect(result[:projects].first[:spend_dollars]).to eq(50.0)
    end

    it "extracts trends" do
      result = subject.summary
      expect(result[:trends]).to have_key(:leads_trend)
      expect(result[:trends]).to have_key(:page_views_trend)
      expect(result[:trends]).to have_key(:unique_visitors_trend)
    end

    it "includes flags for insight detection" do
      result = subject.summary
      expect(result[:flags]).to have_key(:has_stalled_project)
      expect(result[:flags]).to have_key(:has_high_performer)
      expect(result[:flags]).to have_key(:has_new_first_lead)
    end

    it "includes period string" do
      result = subject.summary
      expect(result[:period]).to eq("Last 30 Days")
    end

    it "serializes to JSON without errors" do
      result = subject.summary
      expect { result.to_json }.not_to raise_error
    end

    it "includes trend direction and percent" do
      result = subject.summary
      expect(result[:trends][:leads_trend]).to have_key(:direction)
      expect(result[:trends][:leads_trend]).to have_key(:percent)
    end
  end

  describe "flags detection" do
    context "stalled project" do
      it "detects stalled project when no leads in 7+ days" do
        lead = create(:lead, account: account, email: "test@example.com")
        create(:website_lead, website: website, lead: lead, created_at: 10.days.ago)

        result = subject.summary
        expect(result[:flags][:has_stalled_project]).to be true
      end

      it "does not flag as stalled when recent lead exists" do
        lead = create(:lead, account: account, email: "test@example.com")
        create(:website_lead, website: website, lead: lead, created_at: 2.days.ago)

        result = subject.summary
        expect(result[:flags][:has_stalled_project]).to be false
      end
    end

    context "new first lead" do
      it "detects when a project got its first lead within the date range" do
        # First and only lead was 5 days ago (within 30 day range)
        lead = create(:lead, account: account, email: "first@example.com")
        create(:website_lead, website: website, lead: lead, created_at: 5.days.ago)

        result = subject.summary
        expect(result[:flags][:has_new_first_lead]).to be true
      end

      it "does not flag when first lead was before the date range" do
        # First lead was 45 days ago (outside 30 day range)
        lead = create(:lead, account: account, email: "old@example.com")
        create(:website_lead, website: website, lead: lead, created_at: 45.days.ago)

        result = subject.summary
        expect(result[:flags][:has_new_first_lead]).to be false
      end

      it "returns false when no leads exist" do
        # No leads at all
        result = subject.summary
        expect(result[:flags][:has_new_first_lead]).to be false
      end

      it "checks the first lead, not the most recent" do
        # First lead was 45 days ago (outside range)
        old_lead = create(:lead, account: account, email: "old@example.com")
        create(:website_lead, website: website, lead: old_lead, created_at: 45.days.ago)

        # Recent lead is 2 days ago (but not the first!)
        new_lead = create(:lead, account: account, email: "new@example.com")
        create(:website_lead, website: website, lead: new_lead, created_at: 2.days.ago)

        result = subject.summary
        expect(result[:flags][:has_new_first_lead]).to be false
      end

      it "detects first lead across multiple projects" do
        # First project has old lead
        old_lead = create(:lead, account: account, email: "old@example.com")
        create(:website_lead, website: website, lead: old_lead, created_at: 45.days.ago)

        # Second project got its first lead recently (celebrate!)
        project2 = create(:project, account: account)
        website2 = create(:website, project: project2)
        new_lead = create(:lead, account: account, email: "new_first@example.com")
        create(:website_lead, website: website2, lead: new_lead, created_at: 3.days.ago)

        result = subject.summary
        expect(result[:flags][:has_new_first_lead]).to be true
      end
    end
  end
end
