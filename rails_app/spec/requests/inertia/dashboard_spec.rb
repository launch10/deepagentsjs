# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Dashboard Inertia Page", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }
  let!(:website) { create(:website, project: project) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    sign_in user
  end

  describe "GET /dashboard" do
    it "renders the Dashboard component" do
      get dashboard_path

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq("Dashboard")
    end

    it "includes all_performance data pre-fetched for all date ranges" do
      get dashboard_path

      expect(inertia.props[:all_performance]).to be_a(Hash)
      expect(inertia.props[:all_performance].keys).to contain_exactly(7, 30, 90)

      # Check structure for each date range
      [7, 30, 90].each do |days|
        performance = inertia.props[:all_performance][days]
        expect(performance).to have_key(:leads)
        expect(performance).to have_key(:page_views)
        expect(performance).to have_key(:unique_visitors)
        expect(performance).to have_key(:ctr)
        expect(performance).to have_key(:cpl)
      end
    end

    it "includes all_projects data pre-fetched for all date ranges" do
      project # ensure project is created
      get dashboard_path

      expect(inertia.props[:all_projects]).to be_a(Hash)
      expect(inertia.props[:all_projects].keys).to contain_exactly(7, 30, 90)

      # Each date range should have an array of projects
      [7, 30, 90].each do |days|
        expect(inertia.props[:all_projects][days]).to be_an(Array)
      end
    end

    it "includes status_counts" do
      get dashboard_path

      expect(inertia.props[:status_counts]).to have_key(:all)
      expect(inertia.props[:status_counts]).to have_key(:live)
      expect(inertia.props[:status_counts]).to have_key(:paused)
      expect(inertia.props[:status_counts]).to have_key(:draft)
    end

    it "includes date_range_options" do
      get dashboard_path

      expect(inertia.props[:date_range_options]).to include(
        { label: "Last 7 Days", days: 7 },
        { label: "Last 30 Days", days: 30 },
        { label: "Last 90 Days", days: 90 }
      )
    end

    context "insights props" do
      it "includes fresh insights when available" do
        create(:dashboard_insight, account: account,
          insights: [{ title: "Test" }], generated_at: 1.hour.ago)

        get dashboard_path

        expect(inertia.props[:insights]).to be_present
        expect(inertia.props[:metrics_summary]).to be_nil
      end

      it "includes metrics_summary when insights are stale" do
        create(:dashboard_insight, account: account,
          insights: [{ title: "Test" }], generated_at: 25.hours.ago)

        get dashboard_path

        expect(inertia.props[:insights]).to be_nil
        expect(inertia.props[:metrics_summary]).to be_present
      end

      it "includes metrics_summary when no insights exist" do
        get dashboard_path

        expect(inertia.props[:insights]).to be_nil
        expect(inertia.props[:metrics_summary]).to be_present
      end

      it "handles regenerate_insights param" do
        insight = create(:dashboard_insight, account: account,
          insights: [{ title: "Test" }], generated_at: 1.hour.ago)

        get dashboard_path, params: { regenerate_insights: true }

        expect(insight.reload.generated_at).to be < 1.year.ago
        expect(inertia.props[:insights]).to be_nil
        expect(inertia.props[:metrics_summary]).to be_present
      end
    end

    context "authorization" do
      it "requires authentication (route not accessible when signed out)" do
        sign_out user
        get dashboard_path

        # Route is inside `authenticated :user` block, so returns 404 for unauthenticated users
        expect(response).to have_http_status(:not_found)
      end

      it "requires subscription" do
        # Remove the subscription by disabling the pay customer
        account.set_payment_processor(:fake_processor, allow_fake: true)
        Pay::Subscription.where(customer: account.payment_processor).destroy_all

        get dashboard_path

        expect(response).to redirect_to(pricing_path)
      end
    end
  end
end
