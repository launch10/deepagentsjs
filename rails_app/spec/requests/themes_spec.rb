require 'swagger_helper'

RSpec.describe "Themes API", type: :request do
  let(:user) { create(:user) }
  let(:account) { user.owned_account || create(:account, owner: user) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
  end

  path '/themes' do
    get 'Lists all themes' do
      tags 'Themes'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '200', 'themes retrieved' do
        schema ApiSchemas::Theme.collection_response
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:theme1) { create(:theme, name: 'Modern') }
        let!(:theme2) { create(:theme, name: 'Classic') }
        let!(:label) { create(:theme_label, name: 'Dark') }

        before do
          theme1.theme_labels << label
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.length).to eq(2)

          theme_names = data.map { |t| t['name'] }
          expect(theme_names).to include('Modern', 'Classic')

          modern_theme = data.find { |t| t['name'] == 'Modern' }
          expect(modern_theme['theme_labels']).to be_an(Array)
          expect(modern_theme['theme_labels'].first['name']).to eq('Dark')
        end
      end

      response '200', 'returns empty array when no themes exist' do
        schema ApiSchemas::Theme.collection_response
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data).to be_empty
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '401', 'unauthorized - invalid token' do
        let(:Authorization) { "Bearer invalid_token" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to be_present
        end
      end
    end
  end
end
