require 'swagger_helper'

RSpec.describe "Geo Target Constants API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
  end

  let!(:usa) { GeoTargetConstant.create!(criteria_id: 2840, name: "United States", canonical_name: "United States", target_type: "Country", status: "Active", country_code: "US") }
  let!(:new_york_city) { GeoTargetConstant.create!(criteria_id: 1023191, name: "New York", canonical_name: "New York,New York,United States", target_type: "City", status: "Active", country_code: "US") }
  let!(:new_york_state) { GeoTargetConstant.create!(criteria_id: 21167, name: "New York", canonical_name: "New York,United States", target_type: "State", status: "Active", country_code: "US") }
  let!(:los_angeles) { GeoTargetConstant.create!(criteria_id: 1013962, name: "Los Angeles", canonical_name: "Los Angeles,California,United States", target_type: "City", status: "Active", country_code: "US") }

  def mock_google_ads_api(criteria_ids)
    client = instance_double("GoogleAds::Client")
    gtc_service = instance_double("GoogleAds::GeoTargetConstantService")
    resource = instance_double("GoogleAds::Resource")

    allow(GoogleAds).to receive(:client).and_return(client)
    allow(client).to receive(:service).and_return(double(geo_target_constant: gtc_service))
    allow(client).to receive(:resource).and_return(resource)
    allow(resource).to receive(:location_names).and_yield(double(names: []))

    suggestions = criteria_ids.map do |id|
      double(geo_target_constant: double(resource_name: "geoTargetConstants/#{id}"))
    end
    allow(gtc_service).to receive(:suggest_geo_target_constants).and_return(
      double(geo_target_constant_suggestions: suggestions)
    )
  end

  path '/api/v1/geo_target_constants' do
    get 'Search geo target constants' do
      tags 'Geo Target Constants'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :location_query, in: :query, type: :string, required: true, description: 'Search query for location names'

      response '200', 'returns matching locations' do
        schema APISchemas::GeoTargetConstant.index_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:location_query) { "New York" }

        before do
          mock_google_ads_api([1023191, 21167])
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |d| d["name"] }).to all(eq("New York"))
          expect(data.map { |d| d["target_type"] }).to match_array(["City", "State"])
        end
      end

      response '200', 'returns empty array for no matches' do
        schema APISchemas::GeoTargetConstant.index_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:location_query) { "xyznonexistent" }

        before do
          mock_google_ads_api([])
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to eq([])
        end
      end

      response '200', 'searches canonical name as well' do
        schema APISchemas::GeoTargetConstant.index_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:location_query) { "California" }

        before do
          mock_google_ads_api([1013962])
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first["name"]).to eq("Los Angeles")
        end
      end

      response '401', 'unauthorized without token' do
        let(:Authorization) { nil }
        let(:location_query) { "New York" }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end
end
