# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Leads Inertia Page", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:template) { create(:template) }
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:website) { create(:website, account: account, project: project, template: template) }
  let!(:workflow) { create(:project_workflow, project: project, workflow_type: "launch", step: "website") }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    sign_in user
  end

  describe "GET /projects/:uuid/leads" do
    context "with no leads" do
      it "renders the Leads component" do
        get project_leads_path(project.uuid)

        expect(response).to have_http_status(:ok)
        expect(inertia.component).to eq("Leads")
      end

      it "props conform to Leads schema" do
        get project_leads_path(project.uuid)

        expect_inertia_props_to_match_schema(InertiaSchemas::Leads.props_schema)
      end

      it "returns empty leads array" do
        get project_leads_path(project.uuid)

        expect(inertia.props[:leads]).to eq([])
      end

      it "returns pagination with zero total_count" do
        get project_leads_path(project.uuid)

        expect(inertia.props[:pagination][:total_count]).to eq(0)
        expect(inertia.props[:pagination][:current_page]).to eq(1)
        # Pagy returns 1 for total_pages even when count is 0
        expect(inertia.props[:pagination][:total_pages]).to eq(1)
      end
    end

    context "with leads" do
      let!(:lead1) { create(:lead, account: account, name: "John Doe", email: "john@example.com") }
      let!(:lead2) { create(:lead, account: account, name: nil, email: "anonymous@example.com") }
      let!(:lead3) { create(:lead, account: account, name: "Jane Smith", email: "jane@example.com") }

      before do
        # Create website leads with specific timestamps for ordering
        create(:website_lead, lead: lead1, website: website, created_at: 2.days.ago)
        create(:website_lead, lead: lead2, website: website, created_at: 1.day.ago)
        create(:website_lead, lead: lead3, website: website, created_at: Time.current)
      end

      it "renders leads in descending order by date" do
        get project_leads_path(project.uuid)

        leads = inertia.props[:leads]
        expect(leads.length).to eq(3)

        # Most recent first
        expect(leads[0][:email]).to eq("jane@example.com")
        expect(leads[1][:email]).to eq("anonymous@example.com")
        expect(leads[2][:email]).to eq("john@example.com")
      end

      it "returns null for leads without names" do
        get project_leads_path(project.uuid)

        anonymous_lead = inertia.props[:leads].find { |l| l[:email] == "anonymous@example.com" }
        expect(anonymous_lead[:name]).to be_nil
      end

      it "formats dates correctly" do
        get project_leads_path(project.uuid)

        # Date format should be "Jan 10, 2026" format
        leads = inertia.props[:leads]
        leads.each do |lead|
          expect(lead[:date]).to match(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
        end
      end

      it "returns correct pagination metadata" do
        get project_leads_path(project.uuid)

        pagination = inertia.props[:pagination]
        expect(pagination[:total_count]).to eq(3)
        expect(pagination[:current_page]).to eq(1)
        expect(pagination[:total_pages]).to eq(1)
        expect(pagination[:prev_page]).to be_nil
        expect(pagination[:next_page]).to be_nil
      end
    end

    context "with pagination" do
      before do
        # Create 25 leads for pagination testing (20 per page)
        25.times do |i|
          lead = create(:lead, account: account, email: "lead#{i}@example.com")
          create(:website_lead, lead: lead, website: website, created_at: (25 - i).hours.ago)
        end
      end

      it "returns 20 leads per page" do
        get project_leads_path(project.uuid)

        expect(inertia.props[:leads].length).to eq(20)
      end

      it "returns correct pagination for first page" do
        get project_leads_path(project.uuid)

        pagination = inertia.props[:pagination]
        expect(pagination[:current_page]).to eq(1)
        expect(pagination[:total_pages]).to eq(2)
        expect(pagination[:total_count]).to eq(25)
        expect(pagination[:prev_page]).to be_nil
        expect(pagination[:next_page]).to eq(2)
      end

      it "returns correct pagination for second page" do
        get project_leads_path(project.uuid), params: { page: 2 }

        expect(inertia.props[:leads].length).to eq(5)

        pagination = inertia.props[:pagination]
        expect(pagination[:current_page]).to eq(2)
        expect(pagination[:prev_page]).to eq(1)
        expect(pagination[:next_page]).to be_nil
      end

      it "handles invalid page number gracefully" do
        get project_leads_path(project.uuid), params: { page: 999 }

        # Should fall back to last page (configured in pagy)
        expect(response).to have_http_status(:ok)
        expect(inertia.props[:pagination][:current_page]).to eq(2)
      end
    end

    context "project isolation" do
      let!(:other_project) { create(:project, account: account) }
      let!(:other_website) { create(:website, account: account, project: other_project, template: template) }

      before do
        # Lead for our project
        lead1 = create(:lead, account: account, email: "our@example.com")
        create(:website_lead, lead: lead1, website: website)

        # Lead for other project (should not appear)
        lead2 = create(:lead, account: account, email: "other@example.com")
        create(:website_lead, lead: lead2, website: other_website)
      end

      it "only returns leads for the current project" do
        get project_leads_path(project.uuid)

        leads = inertia.props[:leads]
        expect(leads.length).to eq(1)
        expect(leads[0][:email]).to eq("our@example.com")
      end
    end
  end
end
