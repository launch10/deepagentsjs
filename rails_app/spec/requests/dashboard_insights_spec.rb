require "swagger_helper"

RSpec.describe "Dashboard Insights API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account, name: "Test Project") }
  let!(:website) { create(:website, project: project, account: account) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")

    # Create some basic metrics
    Analytics::CacheService.clear_for_account(account.id)
    create(:analytics_daily_metric, account: account, project: project,
      date: 5.days.ago, leads_count: 10, page_views_count: 100, cost_micros: 50_000_000)
  end

  let(:auth_headers) { auth_headers_for(user) }
  let(:Authorization) { auth_headers["Authorization"] }
  let(:"X-Signature") { auth_headers["X-Signature"] }
  let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

  path "/api/v1/dashboard_insights" do
    get "Retrieves current dashboard insights" do
      tags "Dashboard Insights"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns empty state when no insights exist" do
        schema APISchemas::DashboardInsight.index_response

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be_nil
          expect(data["insights"]).to be_nil
          expect(data["fresh"]).to be false
        end
      end

      context "with existing fresh insights" do
        let!(:dashboard_insight) do
          create(:dashboard_insight, account: account, generated_at: 1.hour.ago)
        end

        response "200", "returns existing fresh insights" do
          schema APISchemas::DashboardInsight.index_response

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["id"]).to eq(dashboard_insight.id)
            expect(data["insights"]).to be_present
            expect(data["fresh"]).to be true
          end
        end
      end

      context "with existing stale insights" do
        let!(:dashboard_insight) do
          create(:dashboard_insight, account: account, generated_at: 25.hours.ago)
        end

        response "200", "returns stale insights with fresh=false" do
          schema APISchemas::DashboardInsight.index_response

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["id"]).to eq(dashboard_insight.id)
            expect(data["insights"]).to be_present
            expect(data["fresh"]).to be false
          end
        end
      end

      response "401", "unauthorized without token" do
        let(:Authorization) { nil }
        let(:"X-Signature") { nil }
        let(:"X-Timestamp") { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end

    post "Creates or updates dashboard insights" do
      tags "Dashboard Insights"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :dashboard_insight_params, in: :body, schema: APISchemas::DashboardInsight.create_params_schema

      let(:valid_insights) do
        [
          {
            title: "Lead Generation Up",
            description: "Leads increased by 23% this week, up to 47 total leads.",
            sentiment: "positive",
            project_uuid: project.uuid,
            action: { label: "View Analytics", url: "/projects/#{project.uuid}/analytics" }
          },
          {
            title: "Project Stalled",
            description: "Budget Travel Guides hasn't generated leads in 14 days.",
            sentiment: "negative",
            project_uuid: nil,
            action: { label: "Review Keywords", url: "/projects/#{project.uuid}/campaigns/content" }
          },
          {
            title: "CTR Improving",
            description: "Click-through rate is up 15% across all campaigns.",
            sentiment: "neutral",
            project_uuid: nil,
            action: { label: "View Dashboard", url: "/dashboard" }
          }
        ]
      end

      let(:dashboard_insight_params) do
        {
          dashboard_insight: {
            insights: valid_insights,
            metrics_summary: { period: "Last 30 Days", totals: { leads: 47 } }
          }
        }
      end

      response "201", "creates new insights" do
        schema APISchemas::DashboardInsight.create_response

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be_present
          expect(data["insights"].length).to eq(3)
          expect(data["fresh"]).to be true
          expect(data["generated_at"]).to be_present
        end
      end

      context "with existing insights" do
        let!(:existing_insight) do
          create(:dashboard_insight, account: account, generated_at: 25.hours.ago)
        end

        response "200", "updates existing insights" do
          schema APISchemas::DashboardInsight.create_response

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["id"]).to eq(existing_insight.id)
            expect(data["insights"]).to eq(valid_insights.map(&:deep_stringify_keys))
            expect(data["fresh"]).to be true
          end
        end
      end

      response "422", "fails with invalid insights" do
        let(:dashboard_insight_params) do
          { dashboard_insight: { insights: [] } }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
        end
      end

      response "401", "unauthorized without token" do
        let(:Authorization) { nil }
        let(:"X-Signature") { nil }
        let(:"X-Timestamp") { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  describe "event tracking" do
    it "tracks insights_viewed" do
      expect(TrackEvent).to receive(:call).with("insights_viewed",
        hash_including(insight_count: kind_of(Integer))
      )
      get "/api/v1/dashboard_insights", headers: auth_headers
    end
  end

  path "/api/v1/dashboard_insights/metrics_summary" do
    get "Retrieves metrics summary for insight generation" do
      tags "Dashboard Insights"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns metrics summary" do
        schema APISchemas::DashboardInsight.metrics_summary_response

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["period"]).to eq("Last 30 Days")
          expect(data["totals"]).to be_present
          expect(data["totals"]["leads"]).to be_present
          expect(data["totals"]["page_views"]).to be_present
          expect(data["totals"]["unique_visitors"]).to be_present
          expect(data["projects"]).to be_an(Array)
          expect(data["trends"]).to be_present
          expect(data["trends"]["unique_visitors_trend"]).to be_present
        end
      end

      response "401", "unauthorized without token" do
        let(:Authorization) { nil }
        let(:"X-Signature") { nil }
        let(:"X-Timestamp") { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end
end
