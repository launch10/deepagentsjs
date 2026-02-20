# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Deploys API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let(:auth_headers) { auth_headers_for(user) }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  def json_response
    JSON.parse(response.body)
  end

  describe "POST /api/v1/deploys" do
    it "creates a website deploy" do
      post "/api/v1/deploys",
        params: {
          project_id: project.id,
          thread_id: SecureRandom.uuid,
          deploy_type: "website"
        },
        headers: auth_headers

      expect(response).to have_http_status(:created)
      expect(json_response["deploy_type"]).to eq("website")
      expect(json_response["instructions"]).to eq({ "website" => true })
    end

    it "creates a campaign deploy" do
      post "/api/v1/deploys",
        params: {
          project_id: project.id,
          thread_id: SecureRandom.uuid,
          deploy_type: "campaign"
        },
        headers: auth_headers

      expect(response).to have_http_status(:created)
      expect(json_response["deploy_type"]).to eq("campaign")
      expect(json_response["instructions"]).to eq({ "website" => true, "googleAds" => true })
    end

    it "defaults deploy_type to website when not provided" do
      post "/api/v1/deploys",
        params: { project_id: project.id, thread_id: SecureRandom.uuid },
        headers: auth_headers

      expect(response).to have_http_status(:created)
      expect(json_response["deploy_type"]).to eq("website")
    end

    it "returns existing in-progress deploy (idempotent)" do
      existing = create(:deploy, :website_only, project: project, status: "running")

      post "/api/v1/deploys",
        params: {
          project_id: project.id,
          thread_id: SecureRandom.uuid,
          deploy_type: "website"
        },
        headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(json_response["id"]).to eq(existing.id)
    end

    it "includes deploy_type and instructions in the response" do
      post "/api/v1/deploys",
        params: {
          project_id: project.id,
          thread_id: SecureRandom.uuid,
          deploy_type: "campaign"
        },
        headers: auth_headers

      expect(json_response).to have_key("deploy_type")
      expect(json_response).to have_key("instructions")
      expect(json_response["instructions"]["website"]).to be true
      expect(json_response["instructions"]["googleAds"]).to be true
    end
  end

  describe "GET /api/v1/deploys" do
    it "returns paginated deploys for a project" do
      7.times do |i|
        d = create(:deploy, :website_only, project: project, status: "completed")
        d.update_column(:created_at, (7 - i).days.ago)
      end

      get "/api/v1/deploys", params: { project_id: project.id }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(json_response["deploys"].length).to eq(5)
      expect(json_response["pagination"]["total_pages"]).to eq(2)
      expect(json_response["pagination"]["total_count"]).to eq(7)
    end

    it "returns second page" do
      7.times do |i|
        d = create(:deploy, :website_only, project: project, status: "completed")
        d.update_column(:created_at, (7 - i).days.ago)
      end

      get "/api/v1/deploys", params: { project_id: project.id, page: 2 }, headers: auth_headers

      expect(json_response["deploys"].length).to eq(2)
      expect(json_response["pagination"]["current_page"]).to eq(2)
    end

    it "excludes pending deploys" do
      create(:deploy, :website_only, project: project, status: "pending")
      create(:deploy, :website_only, project: project, status: "completed")

      get "/api/v1/deploys", params: { project_id: project.id }, headers: auth_headers

      statuses = json_response["deploys"].map { |d| d["status"] }
      expect(statuses).not_to include("pending")
      expect(statuses).to include("completed")
    end

    describe "filtering by deploy_type" do
      before do
        create(:deploy, :website_only, project: project, status: "completed")
        create(:deploy, :full_deploy, project: project, status: "completed")
        create(:deploy, :full_deploy, project: project, status: "completed")
      end

      it "filters for campaign deploys" do
        get "/api/v1/deploys",
          params: { project_id: project.id, deploy_type: "campaign" },
          headers: auth_headers

        expect(json_response["deploys"].length).to eq(2)
        json_response["deploys"].each do |d|
          expect(d["deploy_type"]).to eq("campaign")
        end
      end

      it "filters for website-only deploys" do
        get "/api/v1/deploys",
          params: { project_id: project.id, deploy_type: "website" },
          headers: auth_headers

        expect(json_response["deploys"].length).to eq(1)
        expect(json_response["deploys"][0]["deploy_type"]).to eq("website")
      end
    end

    describe "filtering by status" do
      before do
        create(:deploy, :website_only, project: project, status: "completed")
        create(:deploy, :website_only, project: project, status: "failed")
        create(:deploy, :website_only, project: project, status: "running")
      end

      it "filters by completed status" do
        get "/api/v1/deploys",
          params: { project_id: project.id, status: "completed" },
          headers: auth_headers

        statuses = json_response["deploys"].map { |d| d["status"] }
        expect(statuses).to all(eq("completed"))
      end

      it "filters by failed status" do
        get "/api/v1/deploys",
          params: { project_id: project.id, status: "failed" },
          headers: auth_headers

        statuses = json_response["deploys"].map { |d| d["status"] }
        expect(statuses).to all(eq("failed"))
      end
    end

    describe "combined filtering (deploy_type + status)" do
      it "answers 'has this project ever had a completed campaign deploy?'" do
        create(:deploy, :website_only, project: project, status: "completed")
        create(:deploy, :full_deploy, project: project, status: "running")

        get "/api/v1/deploys",
          params: { project_id: project.id, status: "completed", deploy_type: "campaign" },
          headers: auth_headers

        expect(json_response["deploys"]).to be_empty

        get "/api/v1/deploys",
          params: { project_id: project.id, status: "completed", deploy_type: "website" },
          headers: auth_headers

        expect(json_response["deploys"].length).to eq(1)
      end
    end

    it "scopes to current account's projects only" do
      other_user = create(:user)
      other_project = create(:project, account: other_user.owned_account)
      create(:deploy, :website_only, project: other_project, status: "completed")
      create(:deploy, :website_only, project: project, status: "completed")

      get "/api/v1/deploys", params: { project_id: project.id }, headers: auth_headers

      expect(json_response["deploys"].length).to eq(1)
    end

    it "returns 404 for another account's project" do
      other_user = create(:user)
      other_project = create(:project, account: other_user.owned_account)

      get "/api/v1/deploys", params: { project_id: other_project.id }, headers: auth_headers

      expect(response).to have_http_status(:not_found)
    end

    it "includes deploy_type and instructions in each deploy record" do
      create(:deploy, :full_deploy, project: project, status: "completed")

      get "/api/v1/deploys", params: { project_id: project.id }, headers: auth_headers

      deploy = json_response["deploys"].first
      expect(deploy["deploy_type"]).to eq("campaign")
      expect(deploy["instructions"]["website"]).to be true
      expect(deploy["instructions"]["googleAds"]).to be true
    end

    it "includes revertible field in each deploy record" do
      create(:deploy, :website_only, project: project, status: "completed")

      get "/api/v1/deploys", params: { project_id: project.id }, headers: auth_headers

      deploy = json_response["deploys"].first
      expect(deploy).to have_key("revertible")
    end
  end

  describe "GET /api/v1/deploys/:id" do
    it "returns deploy with deploy_type and instructions" do
      deploy = create(:deploy, :website_only, project: project, status: "completed")

      get "/api/v1/deploys/#{deploy.id}", headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(json_response["deploy_type"]).to eq("website")
      expect(json_response["instructions"]["website"]).to be true
    end
  end

  describe "POST /api/v1/deploys/deactivate" do
    it "deactivates the active deploy for a project" do
      deploy = create(:deploy, :website_only, project: project, status: "completed")

      post "/api/v1/deploys/deactivate",
        params: { project_id: project.id },
        headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(deploy.reload.active).to be false
    end

    it "succeeds even when no active deploy exists" do
      post "/api/v1/deploys/deactivate",
        params: { project_id: project.id },
        headers: auth_headers

      expect(response).to have_http_status(:ok)
    end
  end

  describe "POST /api/v1/deploys/:id/rollback" do
    include WebsiteFileHelpers

    let!(:website) do
      site = create(:website, account: account, project: project)
      site.website_files.create!(minimal_website_files)
      site.snapshot
      site
    end

    it "successfully triggers rollback on a revertible deploy" do
      live_wd = create(:website_deploy, :completed, website: website)
      live_wd.update!(is_live: true, revertible: false, version_path: "#{website.id}/20240201120000")

      revertible_wd = create(:website_deploy, :completed, website: website)
      revertible_wd.update!(is_live: false, revertible: true, version_path: "#{website.id}/20240101120000")

      deploy = create(:deploy, project: project, status: "completed")
      deploy.update_column(:website_deploy_id, revertible_wd.id)

      post "/api/v1/deploys/#{deploy.id}/rollback", headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(json_response["success"]).to be true
    end

    it "returns 422 when website_deploy is not completed" do
      wd = create(:website_deploy, website: website)
      deploy = create(:deploy, project: project, status: "completed")
      deploy.update_column(:website_deploy_id, wd.id)

      post "/api/v1/deploys/#{deploy.id}/rollback", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when website_deploy is not revertible" do
      wd = create(:website_deploy, :completed, website: website)
      wd.reload
      wd.update!(is_live: false, revertible: false, version_path: "#{website.id}/20240101120000")
      deploy = create(:deploy, project: project, status: "completed")
      deploy.update_column(:website_deploy_id, wd.id)

      post "/api/v1/deploys/#{deploy.id}/rollback", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when website_deploy is already live" do
      wd = create(:website_deploy, :completed, website: website)
      wd.update!(is_live: true, revertible: true, version_path: "#{website.id}/20240101120000")
      deploy = create(:deploy, project: project, status: "completed")
      deploy.update_column(:website_deploy_id, wd.id)

      post "/api/v1/deploys/#{deploy.id}/rollback", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when deploy has no website_deploy" do
      deploy = create(:deploy, project: project, status: "completed")

      post "/api/v1/deploys/#{deploy.id}/rollback", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "auto-trigger semantic: 'has user EVER deployed with this type?'" do
    it "website-only completed deploy does not satisfy campaign check" do
      create(:deploy, :website_only, project: project, status: "completed")

      get "/api/v1/deploys",
        params: { project_id: project.id, status: "completed", deploy_type: "campaign" },
        headers: auth_headers

      expect(json_response["deploys"]).to be_empty
    end

    it "campaign completed deploy does not satisfy website-only check" do
      create(:deploy, :full_deploy, project: project, status: "completed")

      get "/api/v1/deploys",
        params: { project_id: project.id, status: "completed", deploy_type: "website" },
        headers: auth_headers

      expect(json_response["deploys"]).to be_empty
    end

    it "failed deploy does not satisfy the check" do
      create(:deploy, :full_deploy, project: project, status: "failed")

      get "/api/v1/deploys",
        params: { project_id: project.id, status: "completed", deploy_type: "campaign" },
        headers: auth_headers

      expect(json_response["deploys"]).to be_empty
    end

    it "deactivated but completed deploy DOES satisfy the check" do
      deploy = create(:deploy, :full_deploy, project: project, status: "completed")
      deploy.deactivate!

      get "/api/v1/deploys",
        params: { project_id: project.id, status: "completed", deploy_type: "campaign" },
        headers: auth_headers

      expect(json_response["deploys"].length).to eq(1)
    end
  end

  describe "removed website_deploys API" do
    it "GET /api/v1/website_deploys returns 404" do
      get "/api/v1/website_deploys", params: { website_id: 1 }, headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
