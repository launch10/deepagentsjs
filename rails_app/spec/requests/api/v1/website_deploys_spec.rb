# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Website Deploys API", type: :request do
  include WebsiteFileHelpers

  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:website) do
    site = create(:website, account: account, project: project)
    site.website_files.create!(minimal_website_files)
    site.snapshot
    site
  end
  let(:auth_headers) { auth_headers_for(user) }
  let(:Authorization) { auth_headers["Authorization"] }
  let(:"X-Signature") { auth_headers["X-Signature"] }
  let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  path "/api/v1/website_deploys/{id}/rollback" do
    post "Rolls back to a previous website deploy" do
      tags "Website Deploys"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :id, in: :path, type: :integer, required: true

      response "200", "successfully triggers rollback" do
        schema APISchemas::WebsiteDeploy.rollback_response

        let!(:live_deploy) do
          d = create(:website_deploy, :completed, website: website)
          d.update!(is_live: true, revertible: false, version_path: "#{website.id}/20240201120000")
          d
        end
        let!(:revertible_deploy) do
          d = create(:website_deploy, :completed, website: website)
          d.update!(is_live: false, revertible: true, version_path: "#{website.id}/20240101120000")
          d
        end
        let(:id) { revertible_deploy.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["success"]).to eq(true)
        end
      end

      response "422", "cannot rollback a non-revertible deploy" do
        let!(:non_revertible_deploy) do
          d = create(:website_deploy, :completed, website: website)
          d.reload # after_create callback uses update_all which doesn't update in-memory object
          d.update!(is_live: false, revertible: false, version_path: "#{website.id}/20240101120000")
          d
        end
        let(:id) { non_revertible_deploy.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to be_present
        end
      end

      response "422", "cannot rollback a deploy that is already live" do
        let!(:live_deploy) do
          d = create(:website_deploy, :completed, website: website)
          d.update!(is_live: true, revertible: true, version_path: "#{website.id}/20240101120000")
          d
        end
        let(:id) { live_deploy.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to be_present
        end
      end

      response "422", "cannot rollback a non-completed deploy" do
        let!(:pending_deploy) { create(:website_deploy, website: website) }
        let(:id) { pending_deploy.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to be_present
        end
      end

      response "404", "returns not found for deploy belonging to another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_project) { create(:project, account: other_account) }
        let!(:other_website) do
          site = create(:website, account: other_account, project: other_project)
          site.website_files.create!(minimal_website_files)
          site.snapshot
          site
        end
        let!(:other_deploy) do
          d = create(:website_deploy, :completed, website: other_website)
          d.update!(is_live: false, revertible: true, version_path: "#{other_website.id}/20240101120000")
          d
        end
        let(:id) { other_deploy.id }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end

      response "404", "returns not found for non-existent deploy" do
        let(:id) { 999999 }

        run_test! do |response|
          expect(response.code).to eq("404")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:deploy) do
          d = create(:website_deploy, :completed, website: website)
          d.update!(is_live: false, revertible: true, version_path: "#{website.id}/20240101120000")
          d
        end
        let(:id) { deploy.id }
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
