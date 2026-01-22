require 'rails_helper'

RSpec.describe "Projects", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:template) { create(:template) }
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:thread_id) { SecureRandom.uuid }

  let!(:brainstorm_data) do
    Brainstorm.create_brainstorm!(
      account,
      name: "Test Brainstorm",
      thread_id: thread_id,
      project_attributes: { uuid: thread_id }
    )
  end

  let!(:project) { brainstorm_data[:project] }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    sign_in user
  end

  describe "GET /projects/:uuid/brainstorm" do
    it "renders the project show page" do
      get brainstorm_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
    end

    it "loads existing conversation data after brainstorm creation (simulates page reload)" do
      # This test simulates the Playwright "loads existing conversation from URL" flow
      # 1. Brainstorm is created via langgraph -> rails API
      # 2. User reloads the page at /projects/:uuid/brainstorm
      # 3. Page should load with existing conversation data

      get brainstorm_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Brainstorm')

      # Verify the Inertia response contains the expected data
      expect(inertia.props[:thread_id]).to eq(thread_id)
      expect(inertia.props[:project]["uuid"]).to eq(thread_id)
      expect(inertia.props[:brainstorm]).to be_present
      expect(inertia.props[:brainstorm]["id"]).to eq(brainstorm_data[:brainstorm].id)
      expect(inertia.props[:website]).to be_present
      expect(inertia.props[:chat]).to be_present
    end

    context "with acts_as_tenant scoping" do
      let!(:other_user) { create(:user, name: "Other User") }
      let!(:other_account) { other_user.owned_account }

      before do
        ensure_plans_exist
        subscribe_account(other_account, plan_name: "growth_monthly")
      end

      it "returns 404 when trying to access another account's project" do
        sign_out user
        sign_in other_user

        get brainstorm_project_path(project.uuid)

        expect(response).to have_http_status(:not_found)
      end

      it "can access project after switching to the correct account" do
        # Add user to the project's account
        account.account_users.create!(user: other_user, roles: ["member"])

        sign_out user
        sign_in other_user

        # Switch to the account that owns the project
        get brainstorm_project_path(project.uuid), headers: { "Cookie" => "account_id=#{account.id}" }

        # This should work if tenant switching is properly handled
        # If this fails, it indicates an issue with how we handle account switching
        expect(response).to have_http_status(:ok)
      end
    end

    context "when brainstorm is created via Langgraph test mode API" do
      # This mimics the exact flow that happens in Playwright e2e tests:
      # 1. User logs in (has JWT with their account_id)
      # 2. User sends message, Langgraph creates brainstorm via API with X-Test-Mode
      # 3. User's browser reloads page at /projects/:uuid/brainstorm
      # 4. Page should find the project

      let!(:test_user) { create(:user, email: "test_user@launch10.ai") }
      let!(:test_account) { test_user.owned_account }
      let(:new_thread_id) { SecureRandom.uuid }
      let(:new_project_uuid) { UUID7.generate }

      before do
        ensure_plans_exist
        subscribe_account(test_account, plan_name: "growth_monthly")
      end

      def test_mode_headers
        timestamp = (Time.current.to_f * 1000).to_i
        proof_payload = { timestamp: timestamp }
        test_proof = JWT.encode(proof_payload, Rails.application.credentials.devise_jwt_secret_key!, "HS256")

        {
          "X-Test-Mode" => "true",
          "X-Test-Proof" => test_proof
        }
      end

      it "creates brainstorm under the correct account and can be accessed after page reload" do
        # Step 1: Create brainstorm via API with test mode headers (mimics Langgraph)
        post "/api/v1/brainstorms",
          params: {
            brainstorm: {
              name: "E2E Test Brainstorm",
              thread_id: new_thread_id,
              project_attributes: { uuid: new_project_uuid }
            }
          },
          headers: test_mode_headers

        expect(response).to have_http_status(:created)
        created_brainstorm = JSON.parse(response.body)

        # Verify the brainstorm was created
        expect(created_brainstorm["thread_id"]).to eq(new_thread_id)

        # Step 2: Find the project that was created
        created_project = Project.unscoped.find_by(uuid: new_project_uuid)
        expect(created_project).to be_present

        # Step 3: Check which account owns the project
        # This is the key assertion - the project should be owned by test_user's account
        expect(created_project.account_id).to eq(test_account.id),
          "Project was created under account #{created_project.account_id} but expected #{test_account.id}"

        # Step 4: Sign in as the test user (mimics browser session)
        sign_in test_user

        # Step 5: Access the brainstorm page (mimics page reload)
        get brainstorm_project_path(new_project_uuid)

        # This should NOT return 404 if tenant scoping is correct
        expect(response).to have_http_status(:ok),
          "Expected 200 but got #{response.status}. Body: #{response.body}"
      end
    end
  end

  describe "GET / (onboarding)" do
    it "renders the project new page" do
      get onboarding_path

      expect(response).to have_http_status(:ok)
    end
  end

  describe "GET /projects/new" do
    context "when authenticated" do
      it "renders the Brainstorm component" do
        get new_project_path

        expect(response).to have_http_status(:ok)
      end
    end

    context "when unauthenticated" do
      before { sign_out user }

      it "returns 404 (route scoped to authenticated users)" do
        get "/projects/new"

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
