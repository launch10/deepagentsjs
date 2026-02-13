require "swagger_helper"

RSpec.describe "Deploys API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account, name: "Test Project") }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  def auth_headers
    auth_headers_for(user)
  end

  let(:thread_id) { SecureRandom.uuid }

  path "/api/v1/deploys" do
    post "Creates a deploy" do
      tags "Deploys"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      parameter name: :deploy_params, in: :body, schema: APISchemas::Deploy.params_schema

      response "201", "deploy created with chat" do
        schema APISchemas::Deploy.response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deploy_params) { { project_id: project.id, thread_id: thread_id } }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to be_present
          expect(data["status"]).to eq("pending")
          expect(data["project_id"]).to eq(project.id)
          expect(data["thread_id"]).to eq(thread_id)

          deploy = Deploy.find(data["id"])
          expect(deploy.project).to eq(project)
          expect(deploy.status).to eq("pending")
          expect(deploy.chat).to be_present
          expect(deploy.chat.thread_id).to eq(thread_id)
          expect(deploy.chat.chat_type).to eq("deploy")
        end
      end

      response "201", "deploy created increments deploy count" do
        schema APISchemas::Deploy.response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deploy_params) { { project_id: project.id, thread_id: thread_id } }

        it "increments the deploy count" do
          expect {
            post "/api/v1/deploys", params: deploy_params, headers: auth_headers, as: :json
          }.to change { project.deploys.count }.by(1)
        end
      end

      response "404", "project not found" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deploy_params) { { project_id: 999999, thread_id: thread_id } }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end

      response "401", "unauthorized" do
        let(:Authorization) { nil }
        let(:deploy_params) { { project_id: project.id, thread_id: thread_id } }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path "/api/v1/deploys/{id}" do
    parameter name: :id, in: :path, type: :integer, description: "Deploy ID"

    get "Retrieves a deploy" do
      tags "Deploys"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      let!(:deploy) { create(:deploy, project: project, status: "running", current_step: "ConnectingGoogle") }

      response "200", "deploy found" do
        schema APISchemas::Deploy.response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to eq(deploy.id)
          expect(data["status"]).to eq("running")
          expect(data["current_step"]).to eq("ConnectingGoogle")
          expect(data["project_id"]).to eq(project.id)
          expect(data["is_live"]).to be false
        end
      end

      response "404", "deploy not found" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { 999999 }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end

      response "404", "cannot access deploy from different account" do
        let(:other_user) { create(:user) }
        let(:other_account) { other_user.owned_account }
        let(:other_project) { create(:project, account: other_account) }
        let!(:other_deploy) { create(:deploy, project: other_project) }

        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { other_deploy.id }

        before do
          ensure_plans_exist
          subscribe_account(other_account, plan_name: "growth_monthly")
        end

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end
    end

    patch "Updates a deploy" do
      tags "Deploys"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      parameter name: :deploy_params, in: :body, schema: {
        type: :object,
        properties: {
          status: { type: :string },
          current_step: { type: :string },
          is_live: { type: :boolean },
          langgraph_thread_id: { type: :string }
        }
      }

      let!(:deploy) { create(:deploy, project: project, status: "pending") }

      response "200", "deploy updated" do
        schema APISchemas::Deploy.response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }
        let(:deploy_params) { { status: "running", current_step: "ConnectingGoogle" } }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["status"]).to eq("running")
          expect(data["current_step"]).to eq("ConnectingGoogle")
          expect(data["thread_id"]).to eq(deploy.thread_id)

          deploy.reload
          expect(deploy.status).to eq("running")
          expect(deploy.current_step).to eq("ConnectingGoogle")
        end
      end

      response "200", "deploy marked as live" do
        schema APISchemas::Deploy.response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }
        let(:deploy_params) { { status: "completed", is_live: true } }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["is_live"]).to be true
          expect(data["status"]).to eq("completed")

          deploy.reload
          expect(deploy.is_live).to be true
        end
      end
    end
  end

  path "/api/v1/deploys/{id}/touch" do
    parameter name: :id, in: :path, type: :integer, description: "Deploy ID"

    post "Updates user activity timestamp" do
      tags "Deploys"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      let!(:deploy) { create(:deploy, project: project, status: "running", user_active_at: 10.minutes.ago) }

      response "200", "user activity updated" do
        schema APISchemas::Deploy.touch_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["touched_at"]).to be_present

          deploy.reload
          expect(deploy.user_active_at).to be_within(5.seconds).of(Time.current)
        end
      end

      response "404", "deploy not found" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { 999999 }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end

      response "404", "cannot touch deploy from different account" do
        let(:other_user) { create(:user) }
        let(:other_account) { other_user.owned_account }
        let(:other_project) { create(:project, account: other_account) }
        let!(:other_deploy) { create(:deploy, project: other_project) }

        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { other_deploy.id }

        before do
          ensure_plans_exist
          subscribe_account(other_account, plan_name: "growth_monthly")
        end

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end
    end
  end
end
