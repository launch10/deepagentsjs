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
    subscribe_account(account, plan_name: 'pro')
    switch_account_to(account)
  end

  path '/api/v1/projects/{project_uuid}/website' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'

    get 'Retrieves a website' do
      tags 'Websites'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let(:project_uuid) { project.uuid }

      response '200', 'website found' do
        schema APISchemas::Website.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }

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

      response '404', 'project not found' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:project_uuid) { 'non-existent-uuid' }

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

      let(:project_uuid) { project.uuid }

      response '200', 'website updated successfully' do
        schema APISchemas::Website.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
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

      response '404', 'project not found' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:project_uuid) { 'non-existent-uuid' }
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
      subscribe_account(other_account, plan_name: 'pro')
    end

    path '/api/v1/projects/{project_uuid}/website' do
      parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'

      patch 'Cannot update other account website' do
        tags 'Websites'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :website_params, in: :body, schema: APISchemas::Website.update_params_schema

        response '404', 'project not found for other account' do
          let(:Authorization) { auth_headers_for(user)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
          let(:project_uuid) { other_project.uuid }
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
