require 'swagger_helper'

RSpec.describe "Themes API", type: :request do
  let(:user) { create(:user) }
  let!(:account) { user.owned_account || create(:account, owner: user) }
  let!(:account2) { create_account_with_user(user, account_name: "User 2 Team Account") }

  let!(:official_theme1) { create(:theme, name: 'Modern', colors: ['#000000', '#ffffff']) }
  let!(:official_theme2) { create(:theme, name: 'Classic', colors: ['#333333', '#eeeeee']) }
  let!(:label) { create(:theme_label, name: 'Dark') }
  let!(:account1_theme1) { create(:theme, name: 'Account 1 Theme 1', colors: ['#111111', '#222222'], author: account) }
  let!(:account1_theme2) { create(:theme, name: 'Account 1 Theme 2', colors: ['#333333', '#444444'], author: account) }
  let!(:account2_theme1) { create(:theme, name: 'Account 2 Theme 1', colors: ['#555555', '#666666'], author: account2) }
  let!(:account2_theme2) { create(:theme, name: 'Account 2 Theme 2', colors: ['#777777', '#888888'], author: account2) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
    subscribe_account(account2, plan_name: 'pro')
  end

  path '/api/v1/themes' do
    get 'Lists official themes + themes in account' do
      tags 'Themes'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      response '200', 'themes retrieved' do
        schema APISchemas::Theme.collection_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }

        before do
          official_theme1.theme_labels << label
          switch_account_to(account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.length).to eq(4)

          theme_names = data.map { |t| t['name'] }
          expect(theme_names).to include('Modern', 'Classic')
          expect(theme_names).to include('Account 1 Theme 1', 'Account 1 Theme 2')
          expect(theme_names).to_not include('Account 2 Theme 1', 'Account 2 Theme 2')

          modern_theme = data.find { |t| t['name'] == 'Modern' }
          expect(modern_theme['colors']).to eq(['#000000', '#ffffff'])
          expect(modern_theme['theme_labels']).to be_an(Array)
          expect(modern_theme['theme_labels'].first['name']).to eq('Dark')
          expect(modern_theme.keys).to match_array(['id', 'name', 'colors', 'theme_labels'])
        end
      end

      response '200', 'retrieves official + account themes' do
        schema APISchemas::Theme.collection_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }

        before do
          switch_account_to(account2)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(4)

          theme_names = data.map { |t| t['name'] }
          expect(theme_names).to include('Modern', 'Classic') # Official themes
          expect(theme_names).to include('Account 2 Theme 1', 'Account 2 Theme 2') # Community themes
          expect(theme_names).to_not include('Account 1 Theme 1', 'Account 1 Theme 2') # Not in this account
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '401', 'unauthorized - invalid token' do
        let(:Authorization) { "Bearer invalid_token" }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end

    post 'Creates theme' do
      tags 'Themes'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :theme, in: :body, schema: APISchemas::Theme.create_request

      response '200', 'theme created' do
        schema APISchemas::Theme.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:theme) { { theme: { name: 'New Theme', colors: ['#000000', '#ffffff'] } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(response.code).to eq("200")
          expect(data['name']).to eq('New Theme')
          expect(data['colors']).to eq(['#000000', '#ffffff'])
          expect(data.keys).to match_array(['id', 'name', 'colors', 'theme_labels'])
        end
      end

      response '401', 'unauthorized' do
        schema APISchemas.error_response
        let(:Authorization) { 'bloop' }
        let(:theme) { { theme: { name: 'New Theme', colors: ['#000000', '#ffffff'] } } }

        run_test! do |response|
          expect(response.code).to eq "401"
        end
      end
    end
  end
end
