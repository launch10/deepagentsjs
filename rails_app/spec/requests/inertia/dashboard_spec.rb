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

    it "includes performance data in props" do
      get dashboard_path

      expect(inertia.props[:performance]).to have_key(:leads)
      expect(inertia.props[:performance]).to have_key(:page_views)
      expect(inertia.props[:performance]).to have_key(:unique_visitors)
      expect(inertia.props[:performance]).to have_key(:ctr)
      expect(inertia.props[:performance]).to have_key(:cpl)
    end

    it "includes projects summary in props" do
      project # ensure project is created
      get dashboard_path

      expect(inertia.props[:projects]).to be_an(Array)
    end

    context "date range filtering" do
      it "defaults to 30 days" do
        get dashboard_path

        expect(inertia.props[:date_range]).to eq("Last 30 Days")
        expect(inertia.props[:days]).to eq(30)
      end

      it "accepts days parameter" do
        get dashboard_path, params: { days: 7 }

        expect(inertia.props[:date_range]).to eq("Last 7 Days")
        expect(inertia.props[:days]).to eq(7)
      end

      it "rejects invalid days parameter and defaults to 30" do
        get dashboard_path, params: { days: 45 }

        expect(inertia.props[:days]).to eq(30)
      end

      it "includes date_range_options" do
        get dashboard_path

        expect(inertia.props[:date_range_options]).to include(
          { label: "Last 7 Days", days: 7 },
          { label: "Last 30 Days", days: 30 },
          { label: "Last 90 Days", days: 90 }
        )
      end
    end

    context "status filtering" do
      it "defaults to 'all'" do
        get dashboard_path

        expect(inertia.props[:status_filter]).to eq("all")
      end

      it "accepts status parameter" do
        get dashboard_path, params: { status: "live" }

        expect(inertia.props[:status_filter]).to eq("live")
      end
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
