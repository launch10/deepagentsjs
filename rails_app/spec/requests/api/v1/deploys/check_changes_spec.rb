# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Deploys check_changes API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:website) { create(:website, project: project, account: account) }
  let!(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:auth_headers) { auth_headers_for(user) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  def json_response
    JSON.parse(response.body)
  end

  describe "POST /api/v1/deploys/check_changes" do
    context "website deploy_type" do
      it "returns website: true when no prior deploy exists" do
        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["website"]).to be true
      end

      it "returns website: true when no previous website deploy" do
        create(:website_file, website: website, path: "/index.html", content: "hello")
        shasum = website.generate_shasum
        create(:website_deploy, website: website, status: "completed", shasum: shasum)

        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["website"]).to be true
      end

      it "returns website: false when files have not changed since last deploy" do
        create(:website_file, website: website, path: "/index.html", content: "hello")
        shasum = website.generate_shasum
        create(:website_deploy, website: website, status: "completed", shasum: shasum, version_path: "#{website.id}/#{Time.now.strftime("%Y%m%d%H%M%S")}")

        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["website"]).to be false
      end

      it "returns website: true when files have changed since last deploy" do
        file = create(:website_file, website: website, path: "/index.html", content: "hello")
        shasum = website.generate_shasum
        create(:website_deploy, website: website, status: "completed", shasum: shasum)

        file.update!(content: "updated")

        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response["website"]).to be true
      end

      it "does not include campaign key for website deploy_type" do
        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(json_response).to have_key("website")
        expect(json_response).not_to have_key("campaign")
      end
    end

    context "campaign deploy_type" do
      it "returns both website and campaign keys" do
        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "campaign" },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response).to have_key("website")
        expect(json_response).to have_key("campaign")
      end

      it "returns campaign: true when no prior deploy exists" do
        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "campaign" },
          headers: auth_headers

        expect(json_response["campaign"]).to be true
      end

      it "returns campaign: false when campaign has not changed since last deploy" do
        shasum = campaign.generate_shasum
        create(:campaign_deploy, campaign: campaign, status: "completed", shasum: shasum)

        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "campaign" },
          headers: auth_headers

        expect(json_response["campaign"]).to be false
      end

      it "returns campaign: true when campaign has changed since last deploy" do
        shasum = campaign.generate_shasum
        create(:campaign_deploy, campaign: campaign, status: "completed", shasum: shasum)

        campaign.update!(name: "Updated Campaign")

        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id, deploy_type: "campaign" },
          headers: auth_headers

        expect(json_response["campaign"]).to be true
      end
    end

    context "default (no deploy_type)" do
      it "defaults to website and returns only website key" do
        post "/api/v1/deploys/check_changes",
          params: { project_id: project.id },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        expect(json_response).to have_key("website")
        expect(json_response).not_to have_key("campaign")
      end
    end

    context "authorization" do
      it "returns 404 for another account's project" do
        other_user = create(:user)
        other_project = create(:project, account: other_user.owned_account)

        post "/api/v1/deploys/check_changes",
          params: { project_id: other_project.id, deploy_type: "website" },
          headers: auth_headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
