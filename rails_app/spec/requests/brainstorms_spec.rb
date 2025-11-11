require 'swagger_helper'

RSpec.describe "Brainstorms API", type: :request do
  let(:user) { create(:user) }
  let(:user_2) { create(:user) }
  let(:account) { user.owned_account || create(:account, owner: user) }
  let(:account_2) { user_2.owned_account || create(:account, owner: user_2) }
  let!(:template) { create(:template) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
  end

  path '/brainstorms' do
    post 'Creates a brainstorm' do
      tags 'Brainstorms'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      parameter name: :brainstorm_params, in: :body, schema: {
        type: :object,
        properties: {
          brainstorm: {
            type: :object,
            properties: {
              name: { type: :string, description: 'Optional name for the brainstorm. Defaults to MM/DD/YYYY HH:MM:SS' },
              thread_id: { type: :string, description: 'Required thread ID from Langgraph' }
            },
            required: ['thread_id']
          }
        },
        required: ['brainstorm']
      }

      response '201', 'brainstorm created with default name' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            website_id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer },
            created_at: { type: :string },
            updated_at: { type: :string }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:brainstorm_params) do
          {
            brainstorm: {
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be_present
          expect(data["thread_id"]).to be_present
          expect(data["name"]).to match(%r{\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}})

          # Verify associated models were created
          brainstorm = Brainstorm.find(data["id"])
          expect(brainstorm).to be_present

          website = brainstorm.website
          expect(website).to be_present

          chat = brainstorm.chat
          project = brainstorm.project

          expect(chat).to be_present
          expect(chat.contextable).to eq(brainstorm)
          expect(chat.project_id).to eq(project.id)
          expect(chat.account_id).to eq(project.account_id)
          expect(chat.thread_id).to eq(brainstorm.thread_id)
          expect(chat.chat_type).to eq("brainstorm")
        end
      end

      response '201', 'brainstorm created with custom name' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            website_id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer },
            created_at: { type: :string },
            updated_at: { type: :string }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:brainstorm_params) do
          {
            brainstorm: {
              name: "My Custom Brainstorm",
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["name"]).to eq("My Custom Brainstorm")

          # Verify name is propagated to website and chat
          brainstorm = Brainstorm.find(data.dig("id"))
          project = brainstorm.project
          website = Website.find_by(project_id: project.id)
          expect(website.name).to eq("My Custom Brainstorm")

          chat = brainstorm.chat
          expect(chat.name).to eq("My Custom Brainstorm")
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:brainstorm_params) do
          {
            brainstorm: {
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '401', 'unauthorized - invalid token' do
        let(:Authorization) { "Bearer invalid_token" }
        let(:brainstorm_params) do
          {
            brainstorm: {
              thread_id: SecureRandom.uuid
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to be_present
        end
      end

      response '422', 'invalid request - missing thread_id' do
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:brainstorm_params) do
          {
            brainstorm: {
              name: "Test Brainstorm"
              # Missing thread_id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
          expect(data["errors"]).to include("Thread ID is required")
        end
      end
    end
  end

  path '/brainstorms/{thread_id}' do
    parameter name: :thread_id, in: :path, type: :string, description: 'Thread ID from Langgraph'

    get 'Retrieves a brainstorm' do
      tags 'Brainstorms'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false

      response '200', 'brainstorm found' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            website_id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer },
            created_at: { type: :string },
            updated_at: { type: :string }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account) }
        let!(:website) { create(:website, project: project, account: account, template: template) }
        let!(:brainstorm) { create(:brainstorm, website: website) }
        let!(:chat) { create(:chat, thread_id: brainstorm.thread_id, project: project, account: account, contextable: brainstorm) }
        let(:thread_id) { brainstorm.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(brainstorm.id)
          expect(data["thread_id"]).to match(/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/)
          expect(data["name"]).to be_present
          expect(data["website_id"]).to eq(website.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let!(:website) { create(:website, project: project, account: account, template: template) }
        let!(:brainstorm) { create(:brainstorm, website: website) }
        let!(:chat) { create(:chat, thread_id: brainstorm.thread_id, project: project, account: account, contextable: brainstorm) }
        let(:thread_id) { brainstorm.thread_id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '404', 'brainstorm not found' do
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let(:thread_id) { 999999 }

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

      parameter name: :brainstorm_params, in: :body, schema: {
        type: :object,
        properties: {
          brainstorm: {
            type: :object,
            properties: {
              name: { type: :string, description: 'Updates project, website, and chat names' },
              idea: { type: :string, description: 'The core idea for the landing page' },
              audience: { type: :string, description: 'Target audience for the landing page' },
              solution: { type: :string, description: 'The solution being offered' },
              social_proof: { type: :string, description: 'Social proof elements' },
              look_and_feel: { type: :string, description: 'Design preferences' }
            }
          }
        },
        required: ['brainstorm']
      }

      response '200', 'brainstorm name updated' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            website_id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer },
            created_at: { type: :string },
            updated_at: { type: :string }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account, name: "Old Name") }
        let!(:website) { create(:website, project: project, account: account, name: "Old Name", template: template) }
        let!(:brainstorm) { create(:brainstorm, website_id: website.id, thread_id: website.thread_id) }
        let!(:chat) { create(:chat, name: "Old Name", chat_type: 'brainstorm', thread_id: brainstorm.thread_id, project_id: project.id, account_id: account.id, contextable: brainstorm) }
        let(:thread_id) { brainstorm.thread_id }
        let(:brainstorm_params) do
          {
            brainstorm: {
              name: "Updated Name"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["name"]).to eq("Updated Name")

          # Verify name was updated for project and chat (not website)
          project.reload
          expect(project.name).to eq("Updated Name")

          chat.reload
          expect(chat.name).to eq("Updated Name")
        end
      end

      response '200', 'brainstorm fields updated' do
        schema type: :object,
          properties: {
            id: { type: :integer },
            website_id: { type: :integer },
            name: { type: :string },
            thread_id: { type: :string },
            account_id: { type: :integer },
            created_at: { type: :string },
            updated_at: { type: :string }
          }

        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
        let!(:project) { create(:project, account: account) }
        let!(:website) { create(:website, project: project, account: account, template: template) }
        let!(:brainstorm) { create(:brainstorm, website_id: website.id, thread_id: website.thread_id) }
        let!(:chat) { create(:chat, name: project.name, chat_type: 'brainstorm', thread_id: website.thread_id, project_id: project.id, account_id: account.id, contextable: brainstorm) }
        let(:thread_id) { website.thread_id }
        let(:brainstorm_params) do
          {
            brainstorm: {
              idea: "Revolutionary product",
              audience: "Tech enthusiasts",
              solution: "AI-powered automation"
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(brainstorm.id)

          # Verify brainstorm fields were updated
          brainstorm.reload
          expect(brainstorm.idea).to eq("Revolutionary product")
          expect(brainstorm.audience).to eq("Tech enthusiasts")
          expect(brainstorm.solution).to eq("AI-powered automation")
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let!(:project) { create(:project, account: account) }
        let!(:website) { create(:website, project: project, account: account, template: template) }
        let!(:brainstorm) { create(:brainstorm, website_id: website.id, thread_id: website.thread_id) }
        let!(:chat) { create(:chat, thread_id: brainstorm.thread_id, project: project, account: account, contextable: brainstorm) }
        let(:thread_id) { brainstorm.thread_id }
        let(:brainstorm_params) { { brainstorm: { name: "Updated" } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["error"]).to eq("Missing token")
        end
      end

      response '404', 'brainstorm not found' do
        let(:Authorization) { "Bearer #{generate_jwt_for(user)}" }
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
