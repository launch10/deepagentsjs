# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Projects Inertia Pages', type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:template) { create(:template) }
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    sign_in user
  end

  describe 'GET /projects/new (onboarding)' do
    it 'renders the Brainstorm component' do
      get onboarding_path

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Brainstorm')
    end

    it 'props conform to BrainstormNew schema' do
      get onboarding_path

      expect_inertia_props_to_match_schema(InertiaSchemas::NewBrainstorm.props_schema)
    end
  end

  let!(:project) { create(:project, account: account) }
  let!(:website) { create(:website, account: account, project: project, template: template) }
  let!(:brainstorm) { create(:brainstorm, website: website, project: project) }
  let!(:workflow) { create(:project_workflow, project: project, workflow_type: 'launch', step: 'ad_campaign', substep: 'content') }
  describe 'GET /projects/:uuid/brainstorm' do
    before do
      workflow.update!(step: 'brainstorm', substep: nil)
    end

    it 'renders the Brainstorm component' do
      get brainstorm_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Brainstorm')
    end

    it 'props conform to Brainstorm schema' do
      get brainstorm_project_path(project.uuid)

      expect_inertia_props_to_match_schema(InertiaSchemas::Brainstorm.props_schema)
    end
  end

  describe 'GET /projects/:uuid/website' do
    before do
      workflow.update!(step: 'website', substep: nil)
    end

    it 'renders the Website component' do
      get website_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Website')
    end

    it 'props conform to Website schema' do
      get website_project_path(project.uuid)

      expect_inertia_props_to_match_schema(InertiaSchemas::Website.props_schema)
    end
  end

  describe 'campaigns substep routes' do
    let!(:campaign) { create(:campaign, account: account, project: project, website: website) }
    let!(:ad_group) { create(:ad_group, campaign: campaign) }
    let!(:ad) { create(:ad, ad_group: ad_group) }

    WorkflowConfig.substeps_for('launch', 'ad_campaign').each do |substep|
      describe "GET /projects/:uuid/campaigns/#{substep}" do
        before do
          workflow.update!(step: 'ad_campaign', substep: substep)
          # Set the campaign stage directly to avoid validation that requires previous stages to be complete
          campaign.update_column(:stage, substep)
        end

        it "renders the Campaign component" do
          get send("campaigns_#{substep}_project_path", project.uuid)

          expect(response).to have_http_status(:ok)
          expect(inertia.component).to eq("Campaign")
        end

        it "props conform to Campaigns::#{substep.camelize} schema" do
          get send("campaigns_#{substep}_project_path", project.uuid)

          schema_module = "InertiaSchemas::Campaigns::#{substep.camelize}".constantize
          expect_inertia_props_to_match_schema(schema_module.props_schema)
        end
      end
    end
  end

  describe 'launch substep routes' do
    let!(:campaign) { create(:campaign, account: account, project: project, website: website) }
    let!(:ad_group) { create(:ad_group, campaign: campaign) }
    let!(:ad) { create(:ad, ad_group: ad_group) }

    WorkflowConfig.substeps_for('launch', 'launch').each do |substep|
      describe "GET /projects/:uuid/launch/#{substep}" do
        before do
          workflow.update!(step: 'launch', substep: substep)
        end

        it "renders the Launch component" do
          get send("launch_#{substep}_project_path", project.uuid)

          expect(response).to have_http_status(:ok)
          expect(inertia.component).to eq("Launch")
        end

        it "props conform to Launch::#{substep.camelize} schema" do
          get send("launch_#{substep}_project_path", project.uuid)

          schema_module = "InertiaSchemas::Launch::#{substep.camelize}".constantize
          expect_inertia_props_to_match_schema(schema_module.props_schema)
        end
      end
    end
  end
end
