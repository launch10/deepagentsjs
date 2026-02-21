# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Leads Export", type: :request do
  include Devise::Test::IntegrationHelpers
  include ActiveSupport::Testing::TimeHelpers

  let!(:template) { create(:template) }
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account, name: "My Test Project") }
  let!(:website) { create(:website, account: account, project: project, template: template) }
  let!(:workflow) { create(:project_workflow, project: project, workflow_type: "launch", step: "website") }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    sign_in user
  end

  describe "GET /projects/:uuid/leads/export" do
    context "with no leads" do
      it "returns CSV with only headers" do
        get export_project_leads_path(project.uuid)

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("text/csv")

        csv = CSV.parse(response.body, headers: true)
        expect(csv.headers).to eq(["Name", "Email", "Phone", "Date"])
        expect(csv.count).to eq(0)
      end

      it "has correct filename format" do
        get export_project_leads_path(project.uuid)

        # Filename should follow pattern: project-name-leads-YYYY-MM-DD.csv
        expect(response.headers["Content-Disposition"]).to match(
          /my-test-project-leads-\d{4}-\d{2}-\d{2}\.csv/
        )
      end
    end

    context "with leads" do
      let!(:lead1) { create(:lead, account: account, name: "John Doe", email: "john@example.com") }
      let!(:lead2) { create(:lead, account: account, name: nil, email: "anonymous@example.com") }
      let!(:lead3) { create(:lead, account: account, name: "Jane Smith", email: "jane@example.com") }

      before do
        create(:website_lead, lead: lead1, website: website, created_at: 2.days.ago)
        create(:website_lead, lead: lead2, website: website, created_at: 1.day.ago)
        create(:website_lead, lead: lead3, website: website, created_at: Time.current)
      end

      it "exports all leads in descending date order" do
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        expect(csv.count).to eq(3)

        # Most recent first
        expect(csv[0]["Email"]).to eq("jane@example.com")
        expect(csv[1]["Email"]).to eq("anonymous@example.com")
        expect(csv[2]["Email"]).to eq("john@example.com")
      end

      it "exports null names as empty strings" do
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        anonymous_row = csv.find { |row| row["Email"] == "anonymous@example.com" }
        expect(anonymous_row["Name"]).to eq("")
      end

      it "exports null phones as empty strings" do
        lead2.update!(phone: nil)
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        anonymous_row = csv.find { |row| row["Email"] == "anonymous@example.com" }
        expect(anonymous_row["Phone"]).to eq("")
      end

      it "includes correct column headers" do
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        expect(csv.headers).to eq(["Name", "Email", "Phone", "Date"])
      end

      it "formats dates correctly" do
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        csv.each do |row|
          expect(row["Date"]).to match(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
        end
      end
    end

    context "project isolation" do
      let!(:other_project) { create(:project, account: account) }
      let!(:other_website) { create(:website, account: account, project: other_project, template: template) }

      before do
        lead1 = create(:lead, account: account, email: "our@example.com")
        create(:website_lead, lead: lead1, website: website)

        lead2 = create(:lead, account: account, email: "other@example.com")
        create(:website_lead, lead: lead2, website: other_website)
      end

      it "only exports leads for the current project" do
        get export_project_leads_path(project.uuid)

        csv = CSV.parse(response.body, headers: true)
        expect(csv.count).to eq(1)
        expect(csv[0]["Email"]).to eq("our@example.com")
      end
    end

    context "authentication" do
      it "returns 404 when not authenticated" do
        sign_out user
        get export_project_leads_path(project.uuid)

        # Route is inside authenticated :user block, so returns 404 to unauthenticated users
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
