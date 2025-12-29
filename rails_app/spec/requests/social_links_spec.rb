require 'swagger_helper'

RSpec.describe "Social Links API", type: :request do
  include SubscriptionHelpers
  include PlanHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
    switch_account_to(account)
  end

  path '/api/v1/projects/{project_uuid}/social_links' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'

    get 'Lists social links for a project' do
      tags 'Social Links'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let(:project_uuid) { project.uuid }

      let!(:twitter_link) { create(:social_link, :twitter, project: project) }
      let!(:instagram_link) { create(:social_link, :instagram, project: project) }

      response '200', 'returns social links for the project' do
        schema APISchemas::SocialLink.list_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          platforms = data.map { |d| d['platform'] }
          expect(platforms).to include('twitter', 'instagram')
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
          expect(data['error']).to eq('Project not found')
        end
      end
    end

    post 'Creates a social link' do
      tags 'Social Links'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :social_link_params, in: :body, schema: APISchemas::SocialLink.params_schema

      let(:project_uuid) { project.uuid }

      response '201', 'social link created successfully' do
        schema APISchemas::SocialLink.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:social_link_params) do
          {
            social_link: {
              platform: 'twitter',
              url: 'https://twitter.com/example',
              handle: '@example'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['platform']).to eq('twitter')
          expect(data['url']).to eq('https://twitter.com/example')
          expect(data['handle']).to eq('@example')
          expect(data['project_id']).to eq(project.id)
        end
      end

      response '422', 'invalid platform' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:social_link_params) do
          {
            social_link: {
              platform: 'invalid_platform',
              url: 'https://example.com'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
        end
      end

      response '422', 'duplicate platform for project' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let!(:existing_link) { create(:social_link, :twitter, project: project) }
        let(:social_link_params) do
          {
            social_link: {
              platform: 'twitter',
              url: 'https://twitter.com/another'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Platform has already been taken')
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:social_link_params) do
          {
            social_link: {
              platform: 'twitter'
            }
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path '/api/v1/projects/{project_uuid}/social_links/{id}' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'
    parameter name: :id, in: :path, type: :integer, description: 'Social Link ID'

    let(:project_uuid) { project.uuid }
    let!(:social_link) { create(:social_link, :twitter, project: project) }

    get 'Retrieves a social link' do
      tags 'Social Links'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      response '200', 'social link found' do
        schema APISchemas::SocialLink.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { social_link.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(social_link.id)
          expect(data['platform']).to eq('twitter')
        end
      end

      response '404', 'social link not found' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Social link not found')
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:id) { social_link.id }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end

    patch 'Updates a social link' do
      tags 'Social Links'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :social_link_params, in: :body, schema: APISchemas::SocialLink.params_schema

      response '200', 'social link updated successfully' do
        schema APISchemas::SocialLink.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { social_link.id }
        let(:social_link_params) do
          {
            social_link: {
              url: 'https://twitter.com/updated',
              handle: '@updated'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['url']).to eq('https://twitter.com/updated')
          expect(data['handle']).to eq('@updated')
        end
      end

      response '422', 'invalid URL format' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { social_link.id }
        let(:social_link_params) do
          {
            social_link: {
              url: 'not-a-valid-url'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
        end
      end

      response '404', 'social link not found' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { 999999 }
        let(:social_link_params) do
          {
            social_link: {
              url: 'https://twitter.com/test'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Social link not found')
        end
      end
    end

    delete 'Deletes a social link' do
      tags 'Social Links'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      response '204', 'social link deleted successfully' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { social_link.id }

        run_test! do |response|
          expect(response.body).to be_empty
          expect(SocialLink.find_by(id: social_link.id)).to be_nil
        end
      end

      response '404', 'social link not found' do
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Social link not found')
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:id) { social_link.id }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path '/api/v1/projects/{project_uuid}/social_links/bulk_upsert' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'

    post 'Bulk upsert social links' do
      tags 'Social Links'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :bulk_params, in: :body, schema: APISchemas::SocialLink.bulk_upsert_params_schema

      let(:project_uuid) { project.uuid }

      response '200', 'all social links created/updated successfully' do
        schema APISchemas::SocialLink.bulk_upsert_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:bulk_params) do
          {
            social_links: [
              { platform: 'twitter', url: 'https://twitter.com/example', handle: '@example' },
              { platform: 'instagram', url: 'https://instagram.com/example', handle: '@example' }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          platforms = data.map { |d| d['platform'] }
          expect(platforms).to contain_exactly('twitter', 'instagram')
        end
      end

      response '200', 'updates existing social links' do
        schema APISchemas::SocialLink.bulk_upsert_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let!(:existing_link) { create(:social_link, :twitter, project: project, handle: '@old') }
        let(:bulk_params) do
          {
            social_links: [
              { platform: 'twitter', url: 'https://twitter.com/updated', handle: '@updated' }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first['id']).to eq(existing_link.id)
          expect(data.first['handle']).to eq('@updated')
        end
      end

      response '422', 'partial failure with errors' do
        schema APISchemas::SocialLink.bulk_upsert_error_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:bulk_params) do
          {
            social_links: [
              { platform: 'twitter', url: 'https://twitter.com/example' },
              { platform: 'invalid_platform', url: 'https://example.com' }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
          expect(data['social_links'].length).to eq(1)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:bulk_params) do
          {
            social_links: [
              { platform: 'twitter' }
            ]
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  # Cross-account access tests
  describe 'Cross-account security' do
    let!(:other_user) { create(:user) }
    let!(:other_account) { other_user.owned_account }
    let!(:other_project) { create(:project, account: other_account) }
    let!(:other_social_link) { create(:social_link, :twitter, project: other_project) }

    before do
      subscribe_account(other_account, plan_name: 'pro')
    end

    path '/api/v1/projects/{project_uuid}/social_links' do
      parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'

      get 'Cannot access other account project social links' do
        tags 'Social Links'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false

        response '404', 'project not found for other account' do
          let(:Authorization) { auth_headers_for(user)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
          let(:project_uuid) { other_project.uuid }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['error']).to eq('Project not found')
          end
        end
      end
    end
  end
end
