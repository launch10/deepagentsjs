require 'swagger_helper'

RSpec.describe "Project Workflows API", type: :request do
  let!(:template) { create(:template) }
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
  let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
  let!(:project2_owned) { create(:project, account: user2_owned_account, name: "User 2 Project") }

  let!(:workflow1_owned) { create(:project_workflow, project: project1_owned, workflow_type: "launch", step: "brainstorm") }
  let!(:workflow1_team) { create(:project_workflow, project: project1_team, workflow_type: "launch", step: "brainstorm") }
  let!(:workflow2_owned) { create(:project_workflow, project: project2_owned, workflow_type: "launch", step: "brainstorm") }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: 'pro')
    subscribe_account(user1_team_account, plan_name: 'pro')
    subscribe_account(user2_owned_account, plan_name: 'pro')
  end

  path '/api/v1/projects/{project_uuid}/workflows/{id}' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'
    parameter name: :id, in: :path, type: :string, description: 'Workflow ID'

    patch 'Updates a project workflow' do
      tags 'Project Workflows'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :project_workflow_params, in: :body, schema: ApiSchemas::ProjectWorkflow.params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'workflow advanced in owned account' do
        schema ApiSchemas::ProjectWorkflow.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }
        let(:project_workflow_params) { { project_workflow: { step: "website" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          workflow1_owned.reload

          expect(workflow1_owned.step).to eq("website")
          expect(data["step"]).to eq("website")
          expect(data["progress"]).to eq(25)
        end
      end

      response '200', 'workflow advanced with substep' do
        schema ApiSchemas::ProjectWorkflow.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }
        let(:project_workflow_params) { { project_workflow: { step: "ad_campaign", substep: "content" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          workflow1_owned.reload

          expect(workflow1_owned.step).to eq("ad_campaign")
          expect(workflow1_owned.substep).to eq("content")
          expect(data["step"]).to eq("ad_campaign")
          expect(data["substep"]).to eq("content")
        end
      end

      response '200', 'workflow advanced in team account after switching' do
        schema ApiSchemas::ProjectWorkflow.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_team.uuid }
        let(:id) { workflow1_team.id }
        let(:project_workflow_params) { { project_workflow: { step: "website" } } }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          workflow1_team.reload

          expect(workflow1_team.step).to eq("website")
          expect(data["step"]).to eq("website")
        end
      end

      response '404', 'workflow not found in owned account' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project2_owned.uuid }
        let(:id) { workflow2_owned.id }
        let(:project_workflow_params) { { project_workflow: { step: "website" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Workflow not found")
        end
      end

      response '404', 'project not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { "nonexistent-uuid" }
        let(:id) { workflow1_owned.id }
        let(:project_workflow_params) { { project_workflow: { step: "website" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Workflow not found")
        end
      end

      response '422', 'invalid step' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }
        let(:project_workflow_params) { { project_workflow: { step: "invalid_step" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Invalid step or substep")

          workflow1_owned.reload
          expect(workflow1_owned.step).to eq("brainstorm")
        end
      end

      response '422', 'missing step parameter' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }
        let(:project_workflow_params) { { project_workflow: {} } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Step is required")
        end
      end
    end
  end

  path '/api/v1/projects/{project_uuid}/workflows/{id}/next' do
    parameter name: :project_uuid, in: :path, type: :string, description: 'Project UUID'
    parameter name: :id, in: :path, type: :string, description: 'Workflow ID'

    patch 'Advances workflow to next step' do
      tags 'Project Workflows'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'workflow advanced to next step' do
        schema ApiSchemas::ProjectWorkflow.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          workflow1_owned.reload

          expect(workflow1_owned.step).to eq("website")
          expect(data["step"]).to eq("website")
          expect(data["progress"]).to eq(25)
        end
      end

      response '200', 'workflow advanced to next step with substep' do
        schema ApiSchemas::ProjectWorkflow.response
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }

        before do
          workflow1_owned.update(step: "website")
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          workflow1_owned.reload

          expect(workflow1_owned.step).to eq("ad_campaign")
          expect(workflow1_owned.substep).to eq("content")
          expect(data["step"]).to eq("ad_campaign")
          expect(data["substep"]).to eq("content")
        end
      end

      response '422', 'already at final step' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project1_owned.uuid }
        let(:id) { workflow1_owned.id }

        before do
          workflow1_owned.update(step: "launch", substep: "deployment")
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Already at final step")

          workflow1_owned.reload
          expect(workflow1_owned.step).to eq("launch")
        end
      end

      response '404', 'workflow not found' do
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let('X-Signature') { auth_headers_for(user1)['X-Signature'] }
        let('X-Timestamp') { auth_headers_for(user1)['X-Timestamp'] }
        let(:project_uuid) { project2_owned.uuid }
        let(:id) { workflow2_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Workflow not found")
        end
      end
    end
  end
end
