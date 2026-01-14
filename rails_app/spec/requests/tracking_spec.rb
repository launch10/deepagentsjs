require 'rails_helper'
require 'sidekiq/testing'

RSpec.describe "Tracking API", type: :request do
  before do
    Sidekiq::Testing.inline! unless self.class.metadata[:sidekiq] == :fake
  end
  # ==========================================================================
  # SECURITY CONTEXT
  # ==========================================================================
  # This is a PUBLIC endpoint - no JWT/session authentication required.
  # Authentication is via project signup_token passed in the request body.
  #
  # The signup_token is embedded in deployed landing pages at build time
  # via the VITE_SIGNUP_TOKEN environment variable.
  # ==========================================================================

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account, name: "Test Landing Page") }
  let!(:website) { create(:website, project: project, account: account) }

  describe "POST /api/v1/tracking/visit" do
    let(:valid_params) do
      {
        token: project.signup_token,
        visitor_token: SecureRandom.uuid,
        visit_token: SecureRandom.uuid,
        referrer: "https://google.com",
        landing_page: "https://my-landing.launch10.site/?utm_source=google",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "summer_sale",
        utm_content: "headline_a",
        utm_term: "buy shoes",
        gclid: "test-gclid-123"
      }
    end

    context "with valid website token" do
      it "creates a new visit" do
        expect {
          post "/api/v1/tracking/visit", params: valid_params, as: :json
        }.to change(Ahoy::Visit, :count).by(1)

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["success"]).to eq(true)
      end

      it "stores all UTM parameters" do
        post "/api/v1/tracking/visit", params: valid_params, as: :json

        visit = Ahoy::Visit.last
        expect(visit.utm_source).to eq("google")
        expect(visit.utm_medium).to eq("cpc")
        expect(visit.utm_campaign).to eq("summer_sale")
        expect(visit.utm_content).to eq("headline_a")
        expect(visit.utm_term).to eq("buy shoes")
      end

      it "stores gclid for attribution" do
        post "/api/v1/tracking/visit", params: valid_params, as: :json

        visit = Ahoy::Visit.last
        expect(visit.gclid).to eq("test-gclid-123")
      end

      it "stores referrer and landing page" do
        post "/api/v1/tracking/visit", params: valid_params, as: :json

        visit = Ahoy::Visit.last
        expect(visit.referrer).to eq("https://google.com")
        expect(visit.landing_page).to eq("https://my-landing.launch10.site/?utm_source=google")
      end

      it "associates visit with website" do
        post "/api/v1/tracking/visit", params: valid_params, as: :json

        visit = Ahoy::Visit.last
        expect(visit.website_id).to eq(website.id)
      end

      it "returns visit_token in response" do
        post "/api/v1/tracking/visit", params: valid_params, as: :json

        data = JSON.parse(response.body)
        expect(data["visit_token"]).to eq(valid_params[:visit_token])
      end

      it "returns existing visit if visit_token already exists" do
        # Create initial visit
        post "/api/v1/tracking/visit", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)

        # Try to create another visit with same token
        expect {
          post "/api/v1/tracking/visit", params: valid_params, as: :json
        }.not_to change(Ahoy::Visit, :count)

        expect(response).to have_http_status(:ok)
      end

      it "stores user agent and IP from request" do
        post "/api/v1/tracking/visit",
          params: valid_params,
          headers: { "HTTP_USER_AGENT" => "Mozilla/5.0 Test Browser" },
          as: :json

        visit = Ahoy::Visit.last
        expect(visit.user_agent).to eq("Mozilla/5.0 Test Browser")
        expect(visit.ip).to be_present
      end
    end

    context "with invalid token" do
      it "returns unauthorized" do
        post "/api/v1/tracking/visit",
          params: valid_params.merge(token: "invalid-token"),
          as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)["error"]).to eq("Invalid token")
      end
    end

    context "with missing token" do
      it "returns unauthorized" do
        post "/api/v1/tracking/visit",
          params: valid_params.except(:token),
          as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with minimal params" do
      it "creates visit with only required fields" do
        minimal_params = {
          token: project.signup_token,
          visitor_token: SecureRandom.uuid,
          visit_token: SecureRandom.uuid
        }

        expect {
          post "/api/v1/tracking/visit", params: minimal_params, as: :json
        }.to change(Ahoy::Visit, :count).by(1)

        expect(response).to have_http_status(:ok)
      end
    end
  end
  describe "POST /api/v1/tracking/event" do
    let!(:visit) do
      Ahoy::Visit.create!(
        website_id: website.id,
        visitor_token: "visitor-123",
        visit_token: "visit-123",
        started_at: Time.current
      )
    end

    let(:valid_event_params) do
      {
        token: project.signup_token,
        visitor_token: "visitor-123",
        visit_token: "visit-123",
        name: "page_view",
        properties: { path: "/", title: "Home" },
        time: Time.current.iso8601
      }
    end

    context "with valid params" do
      it "creates an event" do
        expect {
          post "/api/v1/tracking/event", params: valid_event_params, as: :json
        }.to change(Ahoy::Event, :count).by(1)

        expect(response).to have_http_status(:accepted)
        expect(JSON.parse(response.body)["success"]).to eq(true)
      end

      it "stores event name and properties" do
        post "/api/v1/tracking/event", params: valid_event_params, as: :json

        event = Ahoy::Event.last
        expect(event.name).to eq("page_view")
        expect(event.properties).to eq({ "path" => "/", "title" => "Home" })
      end

      it "associates event with visit" do
        post "/api/v1/tracking/event", params: valid_event_params, as: :json

        event = Ahoy::Event.last
        expect(event.visit_id).to eq(visit.id)
      end
    end

    context "background worker processing", sidekiq: :fake do
      before do
        Sidekiq::Testing.fake!
        Tracking::EventWorker.jobs.clear
      end

      it "enqueues Tracking::EventWorker" do
        expect {
          post "/api/v1/tracking/event", params: valid_event_params, as: :json
        }.to change(Tracking::EventWorker.jobs, :size).by(1)
      end
    end

    context "with custom events" do
      it "tracks button click events" do
        post "/api/v1/tracking/event", params: valid_event_params.merge(
          name: "button_click",
          properties: { button_id: "cta-signup", text: "Sign Up Now" }
        ), as: :json

        expect(response).to have_http_status(:accepted)

        event = Ahoy::Event.last
        expect(event.name).to eq("button_click")
        expect(event.properties["button_id"]).to eq("cta-signup")
      end

      it "tracks scroll depth events" do
        post "/api/v1/tracking/event", params: valid_event_params.merge(
          name: "scroll_depth",
          properties: { depth: 50 }
        ), as: :json

        expect(response).to have_http_status(:accepted)

        event = Ahoy::Event.last
        expect(event.name).to eq("scroll_depth")
        expect(event.properties["depth"]).to eq(50)
      end

      it "tracks form events" do
        post "/api/v1/tracking/event", params: valid_event_params.merge(
          name: "form_start",
          properties: { form_id: "signup-form" }
        ), as: :json

        expect(response).to have_http_status(:accepted)
      end
    end

    context "with invalid token" do
      it "returns unauthorized" do
        post "/api/v1/tracking/event",
          params: valid_event_params.merge(token: "invalid"),
          as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with visit not found" do
      it "returns not found" do
        post "/api/v1/tracking/event",
          params: valid_event_params.merge(visit_token: "nonexistent"),
          as: :json

        expect(response).to have_http_status(:not_found)
        expect(JSON.parse(response.body)["error"]).to eq("Visit not found")
      end
    end

    context "with empty properties" do
      it "creates event with empty properties hash" do
        post "/api/v1/tracking/event", params: valid_event_params.merge(
          properties: nil
        ), as: :json

        expect(response).to have_http_status(:accepted)

        event = Ahoy::Event.last
        expect(event.properties).to eq({})
      end
    end
  end
  describe "analytics queries" do
    let!(:visit1) do
      Ahoy::Visit.create!(
        website_id: website.id,
        visitor_token: "visitor-1",
        visit_token: "visit-1",
        utm_source: "google",
        utm_campaign: "summer_sale",
        utm_content: "headline_a",
        gclid: "gclid-1",
        started_at: 1.day.ago
      )
    end

    let!(:visit2) do
      Ahoy::Visit.create!(
        website_id: website.id,
        visitor_token: "visitor-2",
        visit_token: "visit-2",
        utm_source: "google",
        utm_campaign: "summer_sale",
        utm_content: "headline_b",
        gclid: "gclid-2",
        started_at: Time.current
      )
    end

    let!(:visit3) do
      Ahoy::Visit.create!(
        website_id: website.id,
        visitor_token: "visitor-3",
        visit_token: "visit-3",
        utm_source: "facebook",
        utm_campaign: "winter_promo",
        utm_content: "headline_a",
        started_at: Time.current
      )
    end

    it "can query visits by website" do
      expect(website.visits.count).to eq(3)
    end

    it "can group visits by utm_content for A/B testing" do
      results = website.visits.group(:utm_content).count
      expect(results["headline_a"]).to eq(2)
      expect(results["headline_b"]).to eq(1)
    end

    it "can group visits by utm_campaign" do
      results = website.visits.group(:utm_campaign).count
      expect(results["summer_sale"]).to eq(2)
      expect(results["winter_promo"]).to eq(1)
    end

    it "can filter visits with gclid (Google Ads clicks)" do
      expect(website.visits.where.not(gclid: nil).count).to eq(2)
    end

    it "can count conversions per A/B variant" do
      # Create leads with website_leads linked to visits
      lead1 = create(:lead, account: account, email: "lead1@example.com")
      lead2 = create(:lead, account: account, email: "lead2@example.com")
      create(:website_lead, lead: lead1, website: website, visit: visit1)
      create(:website_lead, lead: lead2, website: website, visit: visit2)

      results = website.visits
        .joins("LEFT JOIN website_leads ON website_leads.visit_id = ahoy_visits.id")
        .group(:utm_content)
        .select("utm_content, COUNT(DISTINCT website_leads.lead_id) as conversions")

      conversions = results.map { |r| [r.utm_content, r.conversions] }.to_h
      expect(conversions["headline_a"]).to eq(1)
      expect(conversions["headline_b"]).to eq(1)
    end
  end
end
