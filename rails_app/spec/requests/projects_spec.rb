require 'rails_helper'

RSpec.describe "Projects", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:template) { create(:template) }
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }

  let!(:brainstorm_data) do
    Brainstorm.create_brainstorm!(
      account,
      name: "Test Brainstorm",
      thread_id: SecureRandom.uuid
    )
  end

  let!(:project) { brainstorm_data[:project] }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
    sign_in user
  end

  describe "GET /projects/:uuid/brainstorm" do
    it "renders the project show page" do
      get brainstorm_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
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
