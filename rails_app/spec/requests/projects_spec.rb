require 'swagger_helper'
RSpec.describe "Projects API", type: :request do
  let(:user) { create(:user) }
  let(:user_2) { create(:user) }
  let(:account) { user.owned_account || create(:account, owner: user) }
  let(:account_2) { user_2.owned_account || create(:account, owner: user_2) }
  let!(:template) { create(:template) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
  end

  path '/projects' do
    get 'Lists all projects' do
      tags 'Projects'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '200', 'projects found' do
        schema type: :object,
          properties: {
            projects: {
              type: :array,
              items: {
                type: :object,
                properties: {
                  id: { type: :integer },
                  name: { type: :string },
                  thread_id: { type: :string },
                  account_id: { type: :integer }
                }
              }
            }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["projects"]).to be_an(Array)
        end
      end

      response '401', 'unauthorized - missing token' do
        schema type: :object,
          properties: {
            error: { type: :string }
          }

        let(:Authorization) { nil }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '401', 'unauthorized - invalid token' do
        schema type: :object,
          properties: {
            error: { type: :string }
          }

        let(:Authorization) { "Bearer invalid_token" }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to be_present
        end
      end
    end

    post 'Creates a project' do
      tags 'Projects'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      parameter name: :project_params, in: :body, schema: {
        type: :object,
        properties: {
          project: {
            type: :object,
            properties: {
              name: { type: :string },
              thread_id: { type: :string }
            },
            required: ['name', 'thread_id']
          }
        },
        required: ['project']
      }

      response '201', 'project created' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:project_params) do
          {
            project: {
              name: "New Project",
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be_present
          expect(data["thread_id"]).to be_present
          expect(data["name"]).to eq("New Project")

          # Verify associated website was created
          project = Project.last
          website = Website.find_by(project_id: project.id)
          expect(website).to be_present
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:project_params) do
          {
            project: {
              name: "New Project",
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '422', 'invalid request' do
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:project_params) do
          {
            project: {
              thread_id: SecureRandom.uuid
              # Missing name
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
        end
      end
    end
  end

  path '/projects/{thread_id}' do
    parameter name: :thread_id, in: :path, type: :string, description: 'Thread ID'

    get 'Retrieves a project' do
      tags 'Projects'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '200', 'project found' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(project.id)
          expect(data["thread_id"]).to eq(project.thread_id)
          expect(data["name"]).to eq(project.name)
        end
      end

      response '401', 'unauthorized' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end
    end

    patch 'Updates a project' do
      tags 'Projects'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      parameter name: :project_params, in: :body, schema: {
        type: :object,
        properties: {
          project: {
            type: :object,
            properties: {
              name: { type: :string }
            }
          }
        },
        required: ['project']
      }

      response '200', 'project updated' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account, name: "Old Name") }
        let(:thread_id) { project.thread_id }
        let(:project_params) do
          {
            project: {
              name: "Updated Name"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["name"]).to eq("Updated Name")

          project.reload
          expect(project.name).to eq("Updated Name")
        end
      end

      response '401', 'unauthorized' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }
        let(:project_params) { { project: { name: "Updated" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end
    end

    delete 'Deletes a project' do
      tags 'Projects'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '204', 'project deleted' do
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          expect(response).to have_http_status(:no_content)
          expect(Project.exists?(project.id)).to be false
        end
      end

      response '401', 'unauthorized' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end
    end
  end

  path '/projects/{thread_id}/files' do
    parameter name: :thread_id, in: :path, type: :string, description: 'Thread ID'

    get 'Retrieves project files' do
      tags 'Projects'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '200', 'files found' do
        schema type: :array,
          items: {
            type: :object,
            properties: {
              id: { type: :integer },
              path: { type: :string },
              content: { type: :string },
              file_type: { type: :string }
            }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
        end
      end

      response '401', 'unauthorized' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let(:thread_id) { project.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end
    end
  end
end
