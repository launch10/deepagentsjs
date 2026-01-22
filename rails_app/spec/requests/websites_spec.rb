require 'swagger_helper'

RSpec.describe "Websites API", type: :request do
  include SubscriptionHelpers
  include PlanHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:theme) { create(:theme) }
  let!(:website) { create(:website, project: project, account: account) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    switch_account_to(account)
  end

  path '/api/v1/websites/{id}' do
    parameter name: :id, in: :path, type: :integer, description: 'Website ID'

    get 'Retrieves a website' do
      tags 'Websites'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let(:id) { website.id }

      response '200', 'website found' do
        schema APISchemas::Website.response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        before do
          website.update!(theme_id: theme.id)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(website.id)
          expect(data['theme_id']).to eq(theme.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '404', 'website not found' do
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Record not found')
        end
      end
    end

    patch 'Updates a website' do
      tags 'Websites'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :website_params, in: :body, schema: APISchemas::Website.update_params_schema

      let(:id) { website.id }

      response '200', 'website updated successfully' do
        schema APISchemas::Website.response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_params) do
          {
            website: {
              theme_id: theme.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['theme_id']).to eq(theme.id)
        end
      end

      response '200', 'website theme update injects CSS variables into index.css' do
        schema APISchemas::Website.response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let!(:template_with_css) { create(:template, :with_index_css) }
        let!(:theme_with_colors) { create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51]) }
        let(:website_params) do
          {
            website: {
              theme_id: theme_with_colors.id
            }
          }
        end

        before do
          website.update!(template: template_with_css)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['theme_id']).to eq(theme_with_colors.id)

          # Verify that the theme CSS was injected
          website.reload
          css_file = website.website_files.find_by(path: "src/index.css")
          expect(css_file).to be_present
          expect(css_file.content).to include("--primary:")
          expect(css_file.content).to include("--background:")
          expect(css_file.content).to include("@tailwind base;")
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:website_params) do
          {
            website: {
              theme_id: theme.id
            }
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '404', 'website not found' do
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { 999999 }
        let(:website_params) do
          {
            website: {
              theme_id: theme.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Record not found')
        end
      end
    end
  end

  # Cross-account access tests
  describe 'Cross-account security' do
    let!(:other_user) { create(:user) }
    let!(:other_account) { other_user.owned_account }
    let!(:other_project) { create(:project, account: other_account) }
    let!(:other_website) { create(:website, project: other_project, account: other_account) }

    before do
      subscribe_account(other_account, plan_name: "growth_monthly")
    end

    path '/api/v1/websites/{id}' do
      parameter name: :id, in: :path, type: :integer, description: 'Website ID'

      patch 'Cannot update other account website' do
        tags 'Websites'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :website_params, in: :body, schema: APISchemas::Website.update_params_schema

        response '404', 'website not found for other account' do
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { other_website.id }
          let(:website_params) do
            {
              website: {
                theme_id: theme.id
              }
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['error']).to eq('Record not found')
          end
        end
      end
    end
  end
end
