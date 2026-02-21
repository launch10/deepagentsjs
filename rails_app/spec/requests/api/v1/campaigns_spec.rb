# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Campaigns API - validate_deploy", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:template) { create(:template) }
  let!(:project) do
    data = Brainstorm.create_brainstorm!(account, name: "Test Project", thread_id: "thread_1")
    data[:project]
  end
  let!(:website) { project.website }
  let(:auth_headers) { auth_headers_for(user) }

  let!(:usa_geo_target) do
    GeoTargetConstant.create!(
      criteria_id: 2840,
      name: "United States",
      canonical_name: "United States",
      target_type: "Country",
      status: "Active",
      country_code: "US"
    )
  end

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  def json_response
    JSON.parse(response.body)
  end

  def create_complete_campaign
    campaign = Campaign.create_campaign!(account, {
      name: "Complete Campaign",
      project_id: project.id,
      website_id: website.id
    })[:campaign]

    ad_group = campaign.ad_groups.first
    ad = ad_group.ads.first

    # Content stage: 3+ headlines, 2+ descriptions
    5.times { |i| ad.headlines.create!(text: "Headline #{i + 1}", position: i) }
    3.times { |i| ad.descriptions.create!(text: "Description #{i + 1}", position: i) }

    # Highlights stage: 2+ callouts
    3.times { |i| campaign.callouts.create!(text: "Callout #{i + 1}", position: i, ad_group: ad_group) }

    # Keywords stage: 5-15 keywords per ad group
    7.times { |i| ad_group.keywords.create!(text: "keyword #{i + 1}", match_type: "broad", position: i) }

    # Settings stage: location, schedule, budget
    campaign.update_location_targets([{
      target_type: "geo_location",
      location_name: "United States",
      location_type: "Country",
      country_code: "US",
      geo_target_constant: "geoTargetConstants/2840",
      targeted: true
    }])
    campaign.ad_schedules.create!(always_on: true)
    campaign.update!(daily_budget_cents: 2500)

    # Launch stage: channel type, bidding strategy, start date
    campaign.update!(
      google_advertising_channel_type: "SEARCH",
      google_bidding_strategy: "MAXIMIZE_CLICKS",
      start_date: Date.tomorrow
    )

    campaign
  end

  describe "POST /api/v1/campaigns/:id/validate_deploy" do
    context "with a fully configured campaign" do
      it "returns valid: true" do
        campaign = create_complete_campaign

        post "/api/v1/campaigns/#{campaign.id}/validate_deploy", headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["valid"]).to be true
        expect(json_response["errors"]).to eq([])
      end
    end

    context "with a campaign missing budget" do
      it "returns valid: false with errors" do
        campaign = create_complete_campaign
        campaign.update!(daily_budget_cents: nil)

        post "/api/v1/campaigns/#{campaign.id}/validate_deploy", headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["valid"]).to be false
        expect(json_response["errors"]).to include(a_string_matching(/daily budget/i))
      end
    end

    context "with a campaign missing keywords" do
      it "returns valid: false with errors" do
        campaign = create_complete_campaign
        campaign.ad_groups.each { |ag| ag.keywords.destroy_all }

        post "/api/v1/campaigns/#{campaign.id}/validate_deploy", headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["valid"]).to be false
        expect(json_response["errors"]).to include(a_string_matching(/keywords/i))
      end
    end

    context "with a bare campaign (no data)" do
      it "returns valid: false with multiple errors" do
        campaign = Campaign.create_campaign!(account, {
          name: "Bare Campaign",
          project_id: project.id,
          website_id: website.id
        })[:campaign]

        post "/api/v1/campaigns/#{campaign.id}/validate_deploy", headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["valid"]).to be false
        expect(json_response["errors"].length).to be > 1
      end
    end

    context "with a non-existent campaign" do
      it "returns 404" do
        post "/api/v1/campaigns/999999/validate_deploy", headers: auth_headers

        expect(response).to have_http_status(:not_found)
        expect(json_response["valid"]).to be false
        expect(json_response["errors"]).to include("Campaign not found")
      end
    end
  end
end
