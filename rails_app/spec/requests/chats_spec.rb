require 'swagger_helper'

RSpec.describe "Chats API", type: :request do
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_account) { user1.owned_account }
  let!(:user2_account) { user2.owned_account }

  let!(:template) { create(:template) }
  let!(:project1) { create(:project, account: user1_account, name: "User 1 Project") }
  let!(:website1) { create(:website, account: user1_account, project: project1, template: template) }
  let!(:project2) { create(:project, account: user2_account, name: "User 2 Project") }

  before do
    ensure_plans_exist
    subscribe_account(user1_account, plan_name: 'pro')
    subscribe_account(user2_account, plan_name: 'pro')
  end

  path '/api/v1/chats/validate' do
    post 'Validates thread ownership' do
      tags 'Chats'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :validate_params, in: :body, schema: APISchemas::Chat.validate_params_schema

      response '403', 'thread does not exist - requires pre-created chat' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:validate_params) { {thread_id: SecureRandom.uuid} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["valid"]).to be false
          expect(data["exists"]).to be false
        end
      end

      response '200', 'thread exists and belongs to current account - valid' do
        schema APISchemas::Chat.validate_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:existing_thread_id) { SecureRandom.uuid }
        let!(:existing_chat) do
          create(:chat,
            thread_id: existing_thread_id,
            chat_type: "website",
            project: project1,
            account: user1_account,
            contextable: website1)
        end
        let(:validate_params) { {thread_id: existing_thread_id} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["valid"]).to be true
          expect(data["exists"]).to be true
          expect(data["chat_type"]).to eq("website")
          expect(data["project_id"]).to eq(project1.id)
        end
      end

      response '403', 'thread exists but belongs to different account - invalid' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:other_thread_id) { SecureRandom.uuid }
        let!(:other_chat) do
          create(:chat,
            thread_id: other_thread_id,
            chat_type: "brainstorm",
            project: project2,
            account: user2_account,
            contextable: nil)
        end
        let(:validate_params) { {thread_id: other_thread_id} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["valid"]).to be false
          expect(data["exists"]).to be true
        end
      end

      response '422', 'missing thread_id' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:validate_params) { {} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Thread ID is required")
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:validate_params) { {thread_id: SecureRandom.uuid} }

        run_test!
      end
    end
  end

  path '/api/v1/chats' do
    post 'Creates a chat for thread ownership' do
      tags 'Chats'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :chat_params, in: :body, schema: APISchemas::Chat.create_params_schema

      response '201', 'chat created successfully' do
        schema APISchemas::Chat.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:chat_params) do
          {
            chat: {
              thread_id: SecureRandom.uuid,
              chat_type: "website",
              project_id: project1.id,
              name: "My Website Chat",
              contextable_type: "Website",
              contextable_id: website1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["thread_id"]).to eq(chat_params[:chat][:thread_id])
          expect(data["chat_type"]).to eq("website")
          expect(data["project_id"]).to eq(project1.id)
          expect(data["account_id"]).to eq(user1_account.id)
          expect(data["name"]).to eq("My Website Chat")

          # Verify it was saved to database
          chat = Chat.find(data["id"])
          expect(chat.account_id).to eq(user1_account.id)
        end
      end

      response '201', 'chat created for deploy type' do
        schema APISchemas::Chat.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let!(:deploy1) { create(:deploy, project: project1) }
        let(:chat_params) do
          {
            chat: {
              thread_id: SecureRandom.uuid,
              chat_type: "deploy",
              project_id: project1.id,
              contextable_type: "Deploy",
              contextable_id: deploy1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["chat_type"]).to eq("deploy")
          expect(data["project_id"]).to eq(project1.id)
        end
      end

      response '200', 'chat already exists for same account - returns existing' do
        schema APISchemas::Chat.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:existing_thread_id) { SecureRandom.uuid }
        let!(:existing_chat) do
          create(:chat,
            thread_id: existing_thread_id,
            chat_type: "website",
            project: project1,
            account: user1_account,
            contextable: website1)
        end
        let(:chat_params) do
          {
            chat: {
              thread_id: existing_thread_id,
              chat_type: "website",
              project_id: project1.id,
              contextable_type: "Website",
              contextable_id: website1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(existing_chat.id)
        end
      end

      response '403', 'thread already exists for different account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:other_thread_id) { SecureRandom.uuid }
        let!(:other_chat) do
          create(:chat,
            thread_id: other_thread_id,
            chat_type: "brainstorm",
            project: project2,
            account: user2_account,
            contextable: nil)
        end
        let(:chat_params) do
          {
            chat: {
              thread_id: other_thread_id,
              chat_type: "website",
              project_id: project1.id,
              contextable_type: "Website",
              contextable_id: website1.id
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Thread already exists for another account")
        end
      end

      response '404', 'project not found or belongs to different account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:chat_params) do
          {
            chat: {
              thread_id: SecureRandom.uuid,
              chat_type: "website",
              project_id: project2.id,  # belongs to user2
              contextable_type: "Website",
              contextable_id: website1.id  # doesn't matter - project check fails first
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Project not found")
        end
      end

      response '422', 'missing required fields' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:chat_params) { {chat: {}} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to be_present
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:chat_params) do
          {
            chat: {
              thread_id: SecureRandom.uuid,
              chat_type: "website",
              project_id: project1.id
            }
          }
        end

        run_test!
      end
    end
  end
end
