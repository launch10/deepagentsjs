require 'swagger_helper'

RSpec.describe "Brainstorms API", type: :request do
  let!(:template) { create(:template) }
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
  let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
  let!(:project2_owned) { create(:project, account: user2_owned_account, name: "User 2 Project") }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: 'pro')
    subscribe_account(user1_team_account, plan_name: 'pro')
    subscribe_account(user2_owned_account, plan_name: 'pro')
  end

  def valid_brainstorm_params(name:, project_uuid: nil)
    {
      brainstorm: {
        name: name,
        thread_id: SecureRandom.uuid,
        project_attributes: project_uuid ? { uuid: project_uuid } : { uuid: UUID7.generate }
      }
    }
  end

  path '/api/v1/brainstorms' do
    post 'Creates a brainstorm' do
      tags 'Brainstorms'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :brainstorm_params, in: :body, schema: ApiSchemas::Brainstorm.params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '201', 'brainstorm created in owned account' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:brainstorm_params) { valid_brainstorm_params(name: "Brainstorm in Owned Account") }

        run_test! do |response|
          data = JSON.parse(response.body)
          brainstorm = Brainstorm.find(data["id"])

          expect(brainstorm.project.account_id).to eq(user1_owned_account.id)
          expect(brainstorm.name).to eq("Brainstorm in Owned Account")
          expect(brainstorm.website.account_id).to eq(user1_owned_account.id)
          expect(brainstorm.chat.account_id).to eq(user1_owned_account.id)

          expect(brainstorm.project.workflows.launch.first.step).to eq("brainstorm")
          expect(brainstorm.project.workflows.launch.first.substep).to be_nil
        end
      end

      response '201', 'brainstorm created with provided project UUID' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { SecureRandom.uuid }
        let(:brainstorm_params) { valid_brainstorm_params(name: "Brainstorm with UUID", project_uuid: project_uuid) }

        run_test! do |response|
          data = JSON.parse(response.body)
          brainstorm = Brainstorm.find(data["id"])

          expect(brainstorm.project.uuid).to eq(project_uuid)
          expect(brainstorm.project.account_id).to eq(user1_owned_account.id)
          expect(brainstorm.name).to eq("Brainstorm with UUID")
        end
      end

      response '201', 'brainstorm created in team account after switching' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:brainstorm_params) { valid_brainstorm_params(name: "Brainstorm in Team Account") }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          brainstorm = Brainstorm.find(data["id"])

          expect(brainstorm.project.account_id).to eq(user1_team_account.id)
          expect(brainstorm.name).to eq("Brainstorm in Team Account")
          expect(brainstorm.website.account_id).to eq(user1_team_account.id)
          expect(brainstorm.chat.account_id).to eq(user1_team_account.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:brainstorm_params) { valid_brainstorm_params(name: "Test") }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '422', 'invalid request - missing thread_id' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:brainstorm_params) do
          {
            brainstorm: {
              name: "Test Brainstorm"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Thread ID is required")
        end
      end
    end
  end

  path '/api/v1/brainstorms/{thread_id}' do
    parameter name: :thread_id, in: :path, type: :string, description: 'Thread ID from Langgraph'

    get 'Retrieves a brainstorm' do
      tags 'Brainstorms'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, name: "Owned Website", template: template) }
      let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, name: "Team Website", template: template) }

      let!(:brainstorm1_owned) { create(:brainstorm, website: website1_owned, thread_id: "123", project: project1_owned) }
      let!(:brainstorm1_team) { create(:brainstorm, website: website1_team, thread_id: "456", project: project1_team) }

      let!(:chat1_owned) { create(:chat, thread_id: "123", project: project1_owned, account: user1_owned_account, contextable: brainstorm1_owned) }
      let!(:chat1_team) { create(:chat, thread_id: "456", project: project1_team, account: user1_team_account, contextable: brainstorm1_team) }

      response '200', 'brainstorm found in owned account' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "123" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(brainstorm1_owned.id)
          expect(data["thread_id"]).to eq(brainstorm1_owned.thread_id)
        end
      end

      response '404', 'cannot access team account brainstorm from owned account' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "456" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Not found")
        end
      end

      response '200', 'brainstorm found in team account after switching' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "456" }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(brainstorm1_team.id)
          expect(data["thread_id"]).to eq(brainstorm1_team.thread_id)
        end
      end

      response '404', 'brainstorm not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "nonexistent" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Not found")
        end
      end
    end

    patch 'Updates a brainstorm' do
      tags 'Brainstorms'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :brainstorm_params, in: :body, schema: ApiSchemas::Brainstorm.params_schema

      let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, template: template) }
      let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, template: template) }

      let!(:brainstorm1_owned) { create(:brainstorm, website: website1_owned) }
      let!(:brainstorm1_team) { create(:brainstorm, website: website1_team) }

      let!(:chat1_owned) { create(:chat, thread_id: brainstorm1_owned.thread_id, project: project1_owned, account: user1_owned_account, contextable: brainstorm1_owned) }
      let!(:chat1_team) { create(:chat, thread_id: brainstorm1_team.thread_id, project: project1_team, account: user1_team_account, contextable: brainstorm1_team) }

      response '200', 'brainstorm updated in owned account' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { brainstorm1_owned.thread_id }
        let(:brainstorm_params) { { brainstorm: { idea: "Updated idea" } } }

        run_test! do |response|
          brainstorm1_owned.reload
          expect(brainstorm1_owned.idea).to eq("Updated idea")
        end
      end

      response '404', 'cannot update team account brainstorm from owned account' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { brainstorm1_team.thread_id }
        let(:brainstorm_params) { { brainstorm: { idea: "Should not update" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"].first).to include("not found")

          brainstorm1_team.reload
          expect(brainstorm1_team.idea).to be_nil
        end
      end

      response '200', 'brainstorm updated in team account after switching' do
        schema ApiSchemas::Brainstorm.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { brainstorm1_team.thread_id }
        let(:brainstorm_params) { { brainstorm: { idea: "Team idea" } } }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          brainstorm1_team.reload
          expect(brainstorm1_team.idea).to eq("Team idea")
        end
      end

      response '404', 'brainstorm not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "nonexistent-thread-id" }
        let(:brainstorm_params) { { brainstorm: { name: "Updated" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Brainstorm not found")
        end
      end
    end
  end
end
