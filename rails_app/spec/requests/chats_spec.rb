require 'swagger_helper'

RSpec.describe "Chats API", type: :request do
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_account) { user1.owned_account }
  let!(:user2_account) { user2.owned_account }

  let!(:template) { create(:template) }
  let!(:project1) { create(:project, account: user1_account, name: "User 1 Project") }
  # Website auto-creates its chat via ChatCreatable
  let!(:website1) { create(:website, account: user1_account, project: project1, template: template) }
  let!(:project2) { create(:project, account: user2_account, name: "User 2 Project") }
  let!(:website2) { create(:website, account: user2_account, project: project2, template: template) }

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
        # Use the auto-created chat from website1
        let(:validate_params) { {thread_id: website1.chat.thread_id} }

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
        # Use the auto-created chat from website2 (belongs to user2)
        let(:validate_params) { {thread_id: website2.chat.thread_id} }

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
end
