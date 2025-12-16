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
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:location_query) { "New York" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |d| d["name"] }).to all(eq("New York"))
          expect(data.map { |d| d["target_type"] }).to match_array(["City", "State"])
        end
      end

      response '200', 'returns empty array for no matches' do
        schema APISchemas::GeoTargetConstant.index_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:location_query) { "xyznonexistent" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to eq([])
        end
      end

      response '200', 'searches canonical name as well' do
        schema APISchemas::GeoTargetConstant.index_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:location_query) { "California" }

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
