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
    get "Lists paginated deploys for a project" do
      tags "Deploys"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :project_id, in: :query, type: :integer, required: true, description: "Project ID"
      parameter name: :page, in: :query, type: :integer, required: false, description: "Page number (default 1)"
      parameter name: :status, in: :query, type: :string, required: false, description: "Filter by status (completed, failed, running)"

      response "200", "returns paginated deploys" do
        schema APISchemas::Deploy.list_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }

        before do
          7.times do |i|
            d = create(:deploy, :website_only, project: project, status: "completed")
            d.update_column(:created_at, (7 - i).days.ago)
          end
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["deploys"].length).to eq(5)
          expect(data["pagination"]["total_pages"]).to eq(2)
          expect(data["pagination"]["total_count"]).to eq(7)
        end
      end

      response "200", "filters by status" do
        schema APISchemas::Deploy.list_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }
        let(:status) { "completed" }

        before do
          create(:deploy, :website_only, project: project, status: "completed")
          create(:deploy, :website_only, project: project, status: "failed")
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          statuses = data["deploys"].map { |d| d["status"] }
          expect(statuses).to all(eq("completed"))
        end
      end

      response "401", "unauthorized" do
        let(:Authorization) { nil }
        let(:project_id) { project.id }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response "404", "project not found" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { 999999 }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end
    end

    post "Creates a deploy" do
      tags "Deploys"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      parameter name: :deploy_params, in: :body, schema: APISchemas::Deploy.params_schema

      response "201", "deploy created with thread_id" do
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
          expect(deploy.thread_id).to eq(thread_id)
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

      response "200", "returns existing in-progress deploy instead of creating new one" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deploy_params) { { project_id: project.id, thread_id: thread_id } }
        let!(:existing_deploy) { create(:deploy, project: project, status: "running") }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to eq(existing_deploy.id)
          expect(data["status"]).to eq("running")
        end
      end

      it "does not create a new deploy when one is already in progress" do
        existing_deploy = create(:deploy, project: project, status: "pending")

        expect {
          post "/api/v1/deploys", params: { project_id: project.id, thread_id: thread_id }, headers: auth_headers, as: :json
        }.not_to change { project.deploys.count }

        data = JSON.parse(response.body)
        expect(data["id"]).to eq(existing_deploy.id)
      end

      it "creates a new deploy when previous deploy is completed" do
        create(:deploy, project: project, status: "completed")

        expect {
          post "/api/v1/deploys", params: { project_id: project.id, thread_id: thread_id }, headers: auth_headers, as: :json
        }.to change { project.deploys.count }.by(1)

        expect(response).to have_http_status(:created)
      end

      it "creates a new deploy when previous deploy is failed" do
        create(:deploy, project: project, status: "failed")

        expect {
          post "/api/v1/deploys", params: { project_id: project.id, thread_id: thread_id }, headers: auth_headers, as: :json
        }.to change { project.deploys.count }.by(1)

        expect(response).to have_http_status(:created)
      end

      it "handles TOCTOU race gracefully when unique index catches concurrent create" do
        # Simulate the race: the idempotent check sees no deploy, but the INSERT
        # hits the unique index. The rescue path re-checks and finds the winner.
        #
        # We stub create! to:
        #   1. First call: insert the "race winner" via raw SQL (outside the transaction),
        #      then raise RecordNotUnique as the DB would.
        #   2. The rescue handler calls first! and finds the winner.
        call_count = 0
        allow_any_instance_of(ActiveRecord::Associations::CollectionProxy).to receive(:create!).and_wrap_original do |method, *args, **kwargs|
          call_count += 1
          if call_count == 1 && kwargs[:status] == "pending"
            # Simulate the "other thread" winning — insert outside any open transaction
            ActiveRecord::Base.connection.execute(<<~SQL)
              INSERT INTO deploys (project_id, status, active, thread_id, is_live, created_at, updated_at)
              VALUES (#{project.id}, 'pending', true, '#{SecureRandom.uuid}', false, NOW(), NOW())
            SQL
            raise ActiveRecord::RecordNotUnique.new("PG::UniqueViolation")
          else
            method.call(*args, **kwargs)
          end
        end

        post "/api/v1/deploys", params: { project_id: project.id, thread_id: thread_id }, headers: auth_headers, as: :json

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)
        expect(data["status"]).to eq("pending")
        expect(data["project_id"]).to eq(project.id)
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

  path "/api/v1/deploys/deactivate" do
    post "Deactivates the active deploy for a project" do
      tags "Deploys"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      parameter name: :deactivate_params, in: :body, schema: {
        type: :object,
        properties: { project_id: { type: :integer } },
        required: ["project_id"]
      }

      let!(:deploy) { create(:deploy, project: project, status: "completed") }

      response "200", "deploy deactivated" do
        schema APISchemas::Deploy.deactivate_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deactivate_params) { { project_id: project.id } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["success"]).to be true

          deploy.reload
          expect(deploy.active).to be false
          expect(deploy.chat.active).to be false
        end
      end

      response "200", "succeeds even with no active deploy" do
        schema APISchemas::Deploy.deactivate_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:deactivate_params) { { project_id: project.id } }

        before { deploy.deactivate! }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["success"]).to be true
        end
      end
    end
  end

  path "/api/v1/deploys/{id}/rollback" do
    parameter name: :id, in: :path, type: :integer, description: "Deploy ID"

    post "Rolls back a deploy" do
      tags "Deploys"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      let!(:website) { create(:website, project: project) }
      let!(:website_deploy) do
        allow_any_instance_of(WebsiteDeploy).to receive(:validate_website_has_files)
        create(:website_deploy, website: website, status: "completed", is_live: false)
      end
      let!(:deploy) { create(:deploy, project: project, status: "completed", website_deploy: website_deploy) }

      response "200", "deploy rolled back" do
        schema APISchemas::Deploy.rollback_response
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }

        before do
          allow_any_instance_of(WebsiteDeploy).to receive(:revertible?).and_return(true)
          allow_any_instance_of(WebsiteDeploy).to receive(:rollback)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["success"]).to be true
        end
      end

      response "422", "non-completed deploy" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }

        before { website_deploy.update!(status: "building") }

        run_test! do |response|
          expect(response.code).to eq("422")
        end
      end

      response "422", "non-revertible deploy" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:id) { deploy.id }

        before do
          allow_any_instance_of(WebsiteDeploy).to receive(:revertible?).and_return(false)
        end

        run_test! do |response|
          expect(response.code).to eq("422")
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
