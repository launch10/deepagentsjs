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

  describe 'GET /projects (index)' do
    context 'with no projects' do
      it 'renders the Projects component' do
        get projects_path

        expect(response).to have_http_status(:ok)
        expect(inertia.component).to eq('Projects')
      end

      it 'props conform to Projects schema' do
        get projects_path

        expect_inertia_props_to_match_schema(InertiaSchemas::Projects.props_schema)
      end
    end
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
  let!(:workflow) { create(:project_workflow, project: project, workflow_type: 'launch', step: 'ads', substep: 'content') }

  describe 'GET /projects (index) with projects' do
    it 'props conform to Projects schema' do
      get projects_path

      expect_inertia_props_to_match_schema(InertiaSchemas::Projects.props_schema)
    end

    it 'includes project data' do
      get projects_path

      expect(inertia.props[:projects].length).to eq(1)
      expect(inertia.props[:pagination][:total_count]).to eq(1)
      expect(inertia.props[:projects].first[:status]).to eq('draft')
    end
  end

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

  describe 'GET /projects/:uuid/website/build' do
    before do
      workflow.update!(step: 'website', substep: 'build')
    end

    it 'renders the Website component' do
      get website_build_project_path(project.uuid)

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Website')
    end

    it 'props conform to Website schema' do
      get website_build_project_path(project.uuid)

      expect_inertia_props_to_match_schema(InertiaSchemas::Website.props_schema)
    end
  end

  describe 'campaigns substep routes' do
    let!(:campaign) { create(:campaign, account: account, project: project, website: website) }
    let!(:ad_group) { create(:ad_group, campaign: campaign) }
    let!(:ad) { create(:ad, ad_group: ad_group) }

    WorkflowConfig.substeps_for('launch', 'ads').each do |substep|
      describe "GET /projects/:uuid/campaigns/#{substep}" do
        before do
          workflow.update!(step: 'ads', substep: substep)
          # Set the campaign stage directly to avoid validation that requires previous stages to be complete
          campaign.update_column(:stage, substep)
        end

        it "renders the Campaign component" do
          get send("campaigns_#{substep}_project_path", project.uuid)

          expect(response).to have_http_status(:ok)
          expect(inertia.component).to eq("Ads")
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

  describe 'workflow step tracking across page transitions' do
    # Regression tests: every controller action must update workflow.step to match the page,
    # so that current_chat returns the correct chat (and thus the correct thread_id in props).
    # Without this, navigating from e.g. website → campaigns would leave step="website",
    # causing the campaign page to load the website chat's messages.

    let!(:campaign) { create(:campaign, account: account, project: project, website: website) }
    let!(:ad_group) { create(:ad_group, campaign: campaign) }
    let!(:ad) { create(:ad, ad_group: ad_group) }

    # Ensure each step has its own chat with a distinct thread_id
    let!(:brainstorm_chat) { project.chats.find_by(chat_type: 'brainstorm') }
    let!(:website_chat) { create(:chat, project: project, account: account, chat_type: 'website', thread_id: 'website-thread') }
    let!(:ads_chat) { project.chats.find_by(chat_type: 'ads') }

    shared_examples 'updates workflow step' do |expected_step, expected_substep|
      it "sets workflow step to #{expected_step.inspect} and substep to #{expected_substep.inspect}" do
        make_request
        workflow.reload
        expect(workflow.step).to eq(expected_step)
        expect(workflow.substep).to eq(expected_substep)
      end
    end

    shared_examples 'returns correct thread_id for step' do |expected_chat_type|
      it "returns the #{expected_chat_type} chat's thread_id in props" do
        make_request
        expected_chat = project.chats.find_by(chat_type: expected_chat_type)
        expect(inertia.props[:thread_id]).to eq(expected_chat&.thread_id)
      end
    end

    # ── Forward transitions ──

    context 'website → brainstorm (navigating back)' do
      before { workflow.update!(step: 'website', substep: 'build') }
      let(:make_request) { get brainstorm_project_path(project.uuid) }

      include_examples 'updates workflow step', 'brainstorm', nil
      include_examples 'returns correct thread_id for step', 'brainstorm'
    end

    context 'brainstorm → website/build' do
      before { workflow.update!(step: 'brainstorm', substep: nil) }
      let(:make_request) { get website_build_project_path(project.uuid) }

      include_examples 'updates workflow step', 'website', 'build'
      include_examples 'returns correct thread_id for step', 'website'
    end

    context 'website/build → website/deploy' do
      before { workflow.update!(step: 'website', substep: 'build') }
      let(:make_request) { get website_deploy_project_path(project.uuid) }

      include_examples 'updates workflow step', 'website', 'deploy'
    end

    context 'website/deploy → deploy' do
      before { workflow.update!(step: 'website', substep: 'deploy') }
      let(:make_request) { get deploy_project_path(project.uuid) }

      include_examples 'updates workflow step', 'deploy', nil
    end

    context 'deploy → campaigns/content' do
      before { workflow.update!(step: 'deploy', substep: nil) }
      let(:make_request) { get campaigns_content_project_path(project.uuid) }

      include_examples 'updates workflow step', 'ads', 'content'
      include_examples 'returns correct thread_id for step', 'ads'
    end

    context 'website → campaigns/content (skipping deploy)' do
      before { workflow.update!(step: 'website', substep: 'build') }
      let(:make_request) { get campaigns_content_project_path(project.uuid) }

      include_examples 'updates workflow step', 'ads', 'content'
      include_examples 'returns correct thread_id for step', 'ads'
    end

    # ── Backward transitions ──

    context 'campaigns/content → website/build (navigating back)' do
      before { workflow.update!(step: 'ads', substep: 'content') }
      let(:make_request) { get website_build_project_path(project.uuid) }

      include_examples 'updates workflow step', 'website', 'build'
      include_examples 'returns correct thread_id for step', 'website'
    end

    context 'campaigns/content → brainstorm (navigating back)' do
      before { workflow.update!(step: 'ads', substep: 'content') }
      let(:make_request) { get brainstorm_project_path(project.uuid) }

      include_examples 'updates workflow step', 'brainstorm', nil
      include_examples 'returns correct thread_id for step', 'brainstorm'
    end

    context 'deploy → website/deploy (navigating back)' do
      before { workflow.update!(step: 'deploy', substep: nil) }
      let(:make_request) { get website_deploy_project_path(project.uuid) }

      include_examples 'updates workflow step', 'website', 'deploy'
    end

    # ── Within-page substep transitions ──

    context 'campaigns/content → campaigns/keywords (same page)' do
      before do
        workflow.update!(step: 'ads', substep: 'content')
        # Bypass campaign stage validation (requires previous stages complete)
        campaign.update_column(:stage, 'keywords')
      end
      let(:make_request) { get campaigns_keywords_project_path(project.uuid) }

      include_examples 'updates workflow step', 'ads', 'keywords'
      include_examples 'returns correct thread_id for step', 'ads'
    end
  end

  describe 'deploy page with existing deploys' do
    # Regression: after a redeploy, the deploy page must still pass a thread_id
    # (via core_json from the deploy's Chat) so the frontend doesn't auto-start a new deploy.

    context 'website deploy' do
      let!(:first_deploy) { create(:deploy, :website_only, project: project, status: 'completed') }
      let!(:second_deploy) { create(:deploy, :website_only, project: project, status: 'completed') }

      before { workflow.update!(step: 'website', substep: 'deploy') }

      it 'passes thread_id from the deploy chat' do
        get website_deploy_project_path(project.uuid)

        expect(inertia.props[:thread_id]).to be_present
        expect(inertia.props[:deploy]).to be_present
        expect(inertia.props[:deploy]).not_to have_key(:langgraph_thread_id)
      end
    end

    context 'campaign deploy' do
      let!(:first_deploy) { create(:deploy, :full_deploy, project: project, status: 'completed') }
      let!(:second_deploy) { create(:deploy, :full_deploy, project: project, status: 'completed') }

      before { workflow.update!(step: 'deploy', substep: nil) }

      it 'passes thread_id from the deploy chat' do
        get deploy_project_path(project.uuid)

        expect(inertia.props[:thread_id]).to be_present
        expect(inertia.props[:deploy]).to be_present
        expect(inertia.props[:deploy]).not_to have_key(:langgraph_thread_id)
      end
    end
  end

  describe 'deploy thread_id isolation' do
    # Regression: website deploy thread_id must NOT leak into campaign deploy page.
    # ProjectWorkflow#chat resolves the correct deploy via instruction type.

    it 'does not leak website deploy thread_id to campaign deploy page' do
      website_deploy = create(:deploy, :website_only, project: project, status: 'completed')
      website_deploy.chat.thread_id

      workflow.update!(step: 'deploy', substep: nil)
      get deploy_project_path(project.uuid)

      expect(inertia.props[:thread_id]).to be_nil
      expect(inertia.props[:deploy]).to be_nil
    end

    it 'does not leak campaign deploy thread_id to website deploy page' do
      campaign_deploy = create(:deploy, :full_deploy, project: project, status: 'completed')

      workflow.update!(step: 'website', substep: 'deploy')
      get website_deploy_project_path(project.uuid)

      # full_deploy (campaign type) also deploys website, so current_for(:website) matches it
      # This is expected — finding it on the website deploy page is correct
      expect(inertia.props[:thread_id]).to eq(campaign_deploy.chat.thread_id)
    end

    it 'returns nil thread_id when no matching deploy exists' do
      workflow.update!(step: 'deploy', substep: nil)
      get deploy_project_path(project.uuid)

      expect(inertia.props[:thread_id]).to be_nil
      expect(inertia.props[:deploy]).to be_nil
    end
  end

  describe 'deploy page props contract (useDeployInit relies on these)' do
    # The frontend useDeployInit hook decides what to do based solely on
    # the deploy prop returned by the backend:
    #   - deploy with pending/running status → resume
    #   - deploy with completed/failed status → show terminal state
    #   - deploy is nil → start fresh deploy
    #
    # These tests verify the backend returns the correct deploy prop
    # for each scenario, especially after redeploy (deactivation).

    before { workflow.update!(step: 'deploy', substep: nil) }

    it 'returns deploy: nil when no deploy exists (first visit)' do
      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_nil
    end

    it 'returns the active pending deploy' do
      deploy = create(:deploy, :full_deploy, project: project, status: 'pending')

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_present
      expect(inertia.props[:deploy][:id]).to eq(deploy.id)
      expect(inertia.props[:deploy][:status]).to eq('pending')
    end

    it 'returns the active running deploy' do
      deploy = create(:deploy, :full_deploy, project: project, status: 'running')

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_present
      expect(inertia.props[:deploy][:id]).to eq(deploy.id)
      expect(inertia.props[:deploy][:status]).to eq('running')
    end

    it 'returns the active completed deploy' do
      deploy = create(:deploy, :full_deploy, project: project, status: 'completed')

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_present
      expect(inertia.props[:deploy][:id]).to eq(deploy.id)
      expect(inertia.props[:deploy][:status]).to eq('completed')
    end

    it 'returns the active failed deploy' do
      deploy = create(:deploy, :full_deploy, project: project, status: 'failed')

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_present
      expect(inertia.props[:deploy][:id]).to eq(deploy.id)
      expect(inertia.props[:deploy][:status]).to eq('failed')
    end

    it 'returns deploy: nil after redeploy deactivates the old deploy' do
      # Simulate the redeploy flow:
      # 1. A completed deploy exists
      deploy = create(:deploy, :full_deploy, project: project, status: 'completed')

      # 2. User clicks "Redeploy" → frontend calls deactivate
      deploy.deactivate!

      # 3. Page reloads → backend should return deploy: nil
      #    so useDeployInit takes the "start fresh" path
      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_nil
    end

    it 'returns deploy: nil after redeploy deactivates a failed deploy' do
      deploy = create(:deploy, :full_deploy, project: project, status: 'failed')
      deploy.deactivate!

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_nil
    end

    it 'returns the most recent active deploy when multiple exist' do
      old_deploy = create(:deploy, :full_deploy, project: project, status: 'completed')
      old_deploy.deactivate!
      new_deploy = create(:deploy, :full_deploy, project: project, status: 'running')

      get deploy_project_path(project.uuid)

      expect(inertia.props[:deploy]).to be_present
      expect(inertia.props[:deploy][:id]).to eq(new_deploy.id)
      expect(inertia.props[:deploy][:status]).to eq('running')
    end
  end

  describe 'GET /projects/:uuid/performance' do
    it 'tracks project_performance_viewed' do
      expect(TrackEvent).to receive(:call).with("project_performance_viewed",
        hash_including(project_uuid: project.uuid, has_leads: kind_of(FalseClass)))
      get performance_project_path(project.uuid)
    end
  end

  describe 'DELETE /projects/:uuid (soft delete)' do
    # Create a fully populated project using the proper creation method (mimics real app behavior)
    let!(:brainstorm_data) do
      Brainstorm.create_brainstorm!(account, name: 'Project to Delete', thread_id: 'delete-thread-id')
    end
    let!(:project_to_delete) { brainstorm_data[:project] }
    let!(:delete_website) { brainstorm_data[:website] }
    let!(:delete_brainstorm) { brainstorm_data[:brainstorm] }
    let!(:delete_workflow) { project_to_delete.workflows.first }
    let!(:delete_chat) { brainstorm_data[:chat] }
    let!(:delete_social_link) { create(:social_link, :twitter, project: project_to_delete) }
    let!(:delete_domain) { create(:domain, account: account, domain: "delete-test-#{SecureRandom.hex(4)}.launch10.site") }
    let!(:delete_website_url) { create(:website_url, website: delete_website, domain: delete_domain, account: account) }
    let!(:delete_website_file) { create(:website_file, website: delete_website, path: '/test.html') }
    let!(:delete_deploy) { create(:deploy, project: project_to_delete, status: 'pending') }
    let!(:delete_website_deploy) { create(:website_deploy, website: delete_website) }
    let!(:delete_analytics) { create(:analytics_daily_metric, account: account, project: project_to_delete, date: Date.yesterday) }

    # Store IDs for assertions
    let(:project_id) { project_to_delete.id }
    let(:website_id) { delete_website.id }
    let(:brainstorm_id) { delete_brainstorm.id }
    let(:workflow_id) { delete_workflow.id }
    let(:chat_id) { delete_chat.id }
    let(:social_link_id) { delete_social_link.id }
    let(:domain_id) { delete_domain.id }
    let(:website_url_id) { delete_website_url.id }
    let(:website_file_id) { delete_website_file.id }
    let(:deploy_id) { delete_deploy.id }
    let(:website_deploy_id) { delete_website_deploy.id }
    let(:analytics_id) { delete_analytics.id }

    context 'with authenticated user' do
      it 'soft-deletes the project and redirects to projects index' do
        delete project_path(project_to_delete.uuid)

        expect(response).to redirect_to(projects_path)
        follow_redirect!
        expect(response).to have_http_status(:ok)
      end

      it 'sets deleted_at on the project' do
        expect {
          delete project_path(project_to_delete.uuid)
        }.to change { project_to_delete.reload.deleted_at }.from(nil)

        expect(project_to_delete.deleted_at).to be_present
      end

      describe 'cascading soft-delete to all related models' do
        before do
          # Force evaluation of all lets before deletion
          [project_id, website_id, brainstorm_id, workflow_id, chat_id,
            social_link_id, domain_id, website_url_id, website_file_id,
            deploy_id, website_deploy_id, analytics_id]

          delete project_path(project_to_delete.uuid)
        end

        it 'soft-deletes the project' do
          expect(Project.with_deleted.find(project_id).deleted_at).to be_present
        end

        it 'soft-deletes the website' do
          expect(Website.with_deleted.find(website_id).deleted_at).to be_present
        end

        it 'soft-deletes the brainstorm' do
          expect(Brainstorm.with_deleted.find(brainstorm_id).deleted_at).to be_present
        end

        it 'soft-deletes the project workflow' do
          expect(ProjectWorkflow.with_deleted.find(workflow_id).deleted_at).to be_present
        end

        it 'soft-deletes the chat' do
          expect(Chat.with_deleted.find(chat_id).deleted_at).to be_present
        end

        it 'soft-deletes the social link' do
          expect(SocialLink.with_deleted.find(social_link_id).deleted_at).to be_present
        end

        it 'does NOT soft-delete the domain (domains are account-level resources)' do
          # Domains belong to accounts, not websites. When a project is deleted,
          # the website_url is deleted (breaking the link) but the domain remains
          # available for reuse with other projects in the same account.
          expect(Domain.find(domain_id).deleted_at).to be_nil
        end

        it 'soft-deletes the website URL' do
          expect(WebsiteUrl.with_deleted.find(website_url_id).deleted_at).to be_present
        end

        it 'soft-deletes the website file' do
          expect(WebsiteFile.with_deleted.find(website_file_id).deleted_at).to be_present
        end

        it 'soft-deletes the deploy' do
          expect(Deploy.with_deleted.find(deploy_id).deleted_at).to be_present
        end

        it 'soft-deletes the website deploy' do
          expect(WebsiteDeploy.with_deleted.find(website_deploy_id).deleted_at).to be_present
        end

        it 'soft-deletes the analytics daily metric' do
          expect(AnalyticsDailyMetric.with_deleted.find(analytics_id).deleted_at).to be_present
        end
      end

      describe 'records hidden from default queries after soft-delete' do
        before do
          # Force evaluation of all lets before deletion
          [project_id, website_id, brainstorm_id, workflow_id, chat_id,
            social_link_id, domain_id, website_url_id, website_file_id,
            deploy_id, website_deploy_id, analytics_id]

          delete project_path(project_to_delete.uuid)
        end

        it 'hides the project from default scope' do
          expect(Project.find_by(id: project_id)).to be_nil
        end

        it 'hides the website from default scope' do
          expect(Website.find_by(id: website_id)).to be_nil
        end

        it 'hides the brainstorm from default scope' do
          expect(Brainstorm.find_by(id: brainstorm_id)).to be_nil
        end

        it 'hides the project workflow from default scope' do
          expect(ProjectWorkflow.find_by(id: workflow_id)).to be_nil
        end

        it 'hides the chat from default scope' do
          expect(Chat.find_by(id: chat_id)).to be_nil
        end

        it 'hides the social link from default scope' do
          expect(SocialLink.find_by(id: social_link_id)).to be_nil
        end

        it 'keeps the domain visible (domains are account-level resources)' do
          expect(Domain.find_by(id: domain_id)).to be_present
        end

        it 'hides the website URL from default scope' do
          expect(WebsiteUrl.find_by(id: website_url_id)).to be_nil
        end

        it 'hides the website file from default scope' do
          expect(WebsiteFile.find_by(id: website_file_id)).to be_nil
        end

        it 'hides the deploy from default scope' do
          expect(Deploy.find_by(id: deploy_id)).to be_nil
        end

        it 'hides the website deploy from default scope' do
          expect(WebsiteDeploy.find_by(id: website_deploy_id)).to be_nil
        end

        it 'hides the analytics metric from default scope' do
          expect(AnalyticsDailyMetric.find_by(id: analytics_id)).to be_nil
        end

        it 'does not include deleted project in projects index' do
          get projects_path

          expect(response).to have_http_status(:ok)
          project_uuids = inertia.props[:projects].map { |p| p[:uuid] }
          expect(project_uuids).not_to include(project_to_delete.uuid)
        end
      end

      describe 'unique constraints allow re-creation after soft-delete' do
        let(:original_name) { project_to_delete.name }

        before do
          delete project_path(project_to_delete.uuid)
        end

        it 'allows creating a new project with the same name' do
          expect {
            create(:project, account: account, name: original_name)
          }.not_to raise_error
        end

        it 'allows creating a social link with the same platform after delete' do
          new_project = create(:project, account: account)

          expect {
            create(:social_link, :twitter, project: new_project)
          }.not_to raise_error
        end
      end

      describe 'restore functionality' do
        before do
          # Force evaluation of all lets before deletion
          [project_id, website_id, brainstorm_id, workflow_id, chat_id,
            social_link_id, domain_id, website_url_id, website_file_id,
            deploy_id, website_deploy_id, analytics_id]

          delete project_path(project_to_delete.uuid)
        end

        it 'can restore the project with recursive: true' do
          project_to_delete.reload.restore(recursive: true)

          expect(Project.find(project_id).deleted_at).to be_nil
          expect(Website.find(website_id).deleted_at).to be_nil
          expect(Brainstorm.find(brainstorm_id).deleted_at).to be_nil
          expect(ProjectWorkflow.find(workflow_id).deleted_at).to be_nil
          expect(Chat.find(chat_id).deleted_at).to be_nil
          expect(SocialLink.find(social_link_id).deleted_at).to be_nil
          expect(Deploy.find(deploy_id).deleted_at).to be_nil
        end

        it 'restored project appears in default queries' do
          project_to_delete.reload.restore(recursive: true)

          expect(Project.find_by(id: project_id)).to be_present
          expect(account.projects).to include(project_to_delete)
        end

        it 'restored project appears in projects index' do
          project_to_delete.reload.restore(recursive: true)

          get projects_path

          project_uuids = inertia.props[:projects].map { |p| p[:uuid] }
          expect(project_uuids).to include(project_to_delete.uuid)
        end
      end

      describe 'code_files view excludes soft-deleted files' do
        before do
          # Force evaluation of lets
          [website_id, website_file_id]

          delete project_path(project_to_delete.uuid)
        end

        it 'does not include soft-deleted website files in code_files view' do
          code_files = CodeFile.where(website_id: website_id)
          expect(code_files).to be_empty
        end
      end
    end

    context 'with campaign and ad data' do
      let!(:delete_campaign) { create(:campaign, account: account, project: project_to_delete, website: delete_website) }
      let!(:delete_ad_group) { create(:ad_group, campaign: delete_campaign) }
      let!(:delete_ad) { create(:ad, ad_group: delete_ad_group) }
      let!(:delete_ad_keyword) { create(:ad_keyword, ad_group: delete_ad_group) }
      let!(:delete_ad_headline) { create(:ad_headline, ad: delete_ad) }
      let!(:delete_ad_description) { create(:ad_description, ad: delete_ad) }

      let(:campaign_id) { delete_campaign.id }
      let(:ad_group_id) { delete_ad_group.id }
      let(:ad_id) { delete_ad.id }
      let(:ad_keyword_id) { delete_ad_keyword.id }
      let(:ad_headline_id) { delete_ad_headline.id }
      let(:ad_description_id) { delete_ad_description.id }

      before do
        # Force evaluation of all lets before deletion
        [campaign_id, ad_group_id, ad_id, ad_keyword_id, ad_headline_id, ad_description_id]

        delete project_path(project_to_delete.uuid)
      end

      it 'soft-deletes the campaign' do
        expect(Campaign.with_deleted.find(campaign_id).deleted_at).to be_present
      end

      it 'soft-deletes the ad group' do
        expect(AdGroup.with_deleted.find(ad_group_id).deleted_at).to be_present
      end

      it 'soft-deletes the ad' do
        expect(Ad.with_deleted.find(ad_id).deleted_at).to be_present
      end

      it 'soft-deletes the ad keyword' do
        expect(AdKeyword.with_deleted.find(ad_keyword_id).deleted_at).to be_present
      end

      it 'soft-deletes the ad headline' do
        expect(AdHeadline.with_deleted.find(ad_headline_id).deleted_at).to be_present
      end

      it 'soft-deletes the ad description' do
        expect(AdDescription.with_deleted.find(ad_description_id).deleted_at).to be_present
      end

      it 'hides all ad-related models from default scope' do
        expect(Campaign.find_by(id: campaign_id)).to be_nil
        expect(AdGroup.find_by(id: ad_group_id)).to be_nil
        expect(Ad.find_by(id: ad_id)).to be_nil
        expect(AdKeyword.find_by(id: ad_keyword_id)).to be_nil
        expect(AdHeadline.find_by(id: ad_headline_id)).to be_nil
        expect(AdDescription.find_by(id: ad_description_id)).to be_nil
      end
    end

    context 'with unauthenticated user' do
      before { sign_out user }

      it 'returns 404 for unauthenticated requests' do
        delete project_path(project_to_delete.uuid)

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'cross-account security' do
      let!(:other_user) { create(:user, name: 'Other User') }
      let!(:other_account) { other_user.owned_account }

      before do
        ensure_plans_exist
        subscribe_account(other_account, plan_name: 'growth_monthly')
        sign_out user
        sign_in other_user
      end

      it 'redirects when trying to delete another account project' do
        delete project_path(project_to_delete.uuid)

        expect(response).to have_http_status(:redirect)
      end

      it 'does not soft-delete the project' do
        delete project_path(project_to_delete.uuid)

        expect(project_to_delete.reload.deleted_at).to be_nil
      end
    end

    context 'database record counts' do
      it 'does not hard-delete any records' do
        # Force evaluation of all lets
        [project_id, website_id, brainstorm_id, workflow_id, chat_id,
          social_link_id, domain_id, website_url_id, website_file_id,
          deploy_id, website_deploy_id, analytics_id]

        # Count records before deletion
        counts_before = {
          projects: Project.unscoped.count,
          websites: Website.unscoped.count,
          brainstorms: Brainstorm.unscoped.count,
          workflows: ProjectWorkflow.unscoped.count,
          chats: Chat.unscoped.count,
          social_links: SocialLink.unscoped.count,
          domains: Domain.unscoped.count,
          website_urls: WebsiteUrl.unscoped.count,
          website_files: WebsiteFile.unscoped.count,
          deploys: Deploy.unscoped.count,
          website_deploys: WebsiteDeploy.unscoped.count,
          analytics: AnalyticsDailyMetric.unscoped.count
        }

        delete project_path(project_to_delete.uuid)

        # Verify no records were hard-deleted
        expect(Project.unscoped.count).to eq(counts_before[:projects])
        expect(Website.unscoped.count).to eq(counts_before[:websites])
        expect(Brainstorm.unscoped.count).to eq(counts_before[:brainstorms])
        expect(ProjectWorkflow.unscoped.count).to eq(counts_before[:workflows])
        expect(Chat.unscoped.count).to eq(counts_before[:chats])
        expect(SocialLink.unscoped.count).to eq(counts_before[:social_links])
        expect(Domain.unscoped.count).to eq(counts_before[:domains])
        expect(WebsiteUrl.unscoped.count).to eq(counts_before[:website_urls])
        expect(WebsiteFile.unscoped.count).to eq(counts_before[:website_files])
        expect(Deploy.unscoped.count).to eq(counts_before[:deploys])
        expect(WebsiteDeploy.unscoped.count).to eq(counts_before[:website_deploys])
        expect(AnalyticsDailyMetric.unscoped.count).to eq(counts_before[:analytics])
      end
    end
  end

  describe 'PATCH /projects/:uuid/restore (restore soft-deleted project)' do
    # Create and soft-delete a project with all related data
    let!(:brainstorm_data) do
      Brainstorm.create_brainstorm!(account, name: 'Project to Restore', thread_id: 'restore-thread-id')
    end
    let!(:project_to_restore) { brainstorm_data[:project] }
    let!(:restore_website) { brainstorm_data[:website] }
    let!(:restore_brainstorm) { brainstorm_data[:brainstorm] }
    let!(:restore_workflow) { project_to_restore.workflows.first }
    let!(:restore_chat) { brainstorm_data[:chat] }
    let!(:restore_social_link) { create(:social_link, :twitter, project: project_to_restore) }
    let!(:restore_domain) { create(:domain, account: account, domain: "restore-test-#{SecureRandom.hex(4)}.launch10.site") }
    let!(:restore_website_url) { create(:website_url, website: restore_website, domain: restore_domain, account: account) }
    let!(:restore_website_file) { create(:website_file, website: restore_website, path: '/restore-test.html') }
    let!(:restore_deploy) { create(:deploy, project: project_to_restore, status: 'pending') }
    let!(:restore_website_deploy) { create(:website_deploy, website: restore_website) }
    let!(:restore_analytics) { create(:analytics_daily_metric, account: account, project: project_to_restore, date: Date.yesterday) }

    # Store IDs for assertions
    let(:project_id) { project_to_restore.id }
    let(:website_id) { restore_website.id }
    let(:brainstorm_id) { restore_brainstorm.id }
    let(:workflow_id) { restore_workflow.id }
    let(:chat_id) { restore_chat.id }
    let(:social_link_id) { restore_social_link.id }
    let(:domain_id) { restore_domain.id }
    let(:website_url_id) { restore_website_url.id }
    let(:website_file_id) { restore_website_file.id }
    let(:deploy_id) { restore_deploy.id }
    let(:website_deploy_id) { restore_website_deploy.id }
    let(:analytics_id) { restore_analytics.id }

    # Helper to soft-delete the project
    def soft_delete_project!
      [project_id, website_id, brainstorm_id, workflow_id, chat_id,
        social_link_id, domain_id, website_url_id, website_file_id,
        deploy_id, website_deploy_id, analytics_id]
      project_to_restore.destroy
    end

    context 'with authenticated user' do
      it 'restores the project and redirects to project show page' do
        soft_delete_project!

        patch restore_project_path(project_to_restore.uuid)

        expect(response).to redirect_to(project_path(project_to_restore.uuid))
      end

      it 'clears deleted_at on the project' do
        soft_delete_project!
        expect(Project.with_deleted.find(project_id).deleted_at).to be_present

        patch restore_project_path(project_to_restore.uuid)

        expect(Project.find(project_id).deleted_at).to be_nil
      end

      describe 'cascading restore to all related models' do
        before do
          soft_delete_project!
          patch restore_project_path(project_to_restore.uuid)
        end

        it 'restores the project' do
          expect(Project.find(project_id).deleted_at).to be_nil
        end

        it 'restores the website' do
          expect(Website.find(website_id).deleted_at).to be_nil
        end

        it 'restores the brainstorm' do
          expect(Brainstorm.find(brainstorm_id).deleted_at).to be_nil
        end

        it 'restores the project workflow' do
          expect(ProjectWorkflow.find(workflow_id).deleted_at).to be_nil
        end

        it 'restores the chat' do
          expect(Chat.find(chat_id).deleted_at).to be_nil
        end

        it 'restores the social link' do
          expect(SocialLink.find(social_link_id).deleted_at).to be_nil
        end

        it 'restores the domain' do
          expect(Domain.find(domain_id).deleted_at).to be_nil
        end

        it 'restores the website URL' do
          expect(WebsiteUrl.find(website_url_id).deleted_at).to be_nil
        end

        it 'restores the website file' do
          expect(WebsiteFile.find(website_file_id).deleted_at).to be_nil
        end

        it 'restores the deploy' do
          expect(Deploy.find(deploy_id).deleted_at).to be_nil
        end

        it 'restores the website deploy' do
          expect(WebsiteDeploy.find(website_deploy_id).deleted_at).to be_nil
        end

        it 'restores the analytics daily metric' do
          expect(AnalyticsDailyMetric.find(analytics_id).deleted_at).to be_nil
        end
      end

      describe 'restored records visible in default scope' do
        before do
          soft_delete_project!
          patch restore_project_path(project_to_restore.uuid)
        end

        it 'project appears in account.projects' do
          expect(account.projects).to include(project_to_restore)
        end

        it 'project appears in projects index' do
          get projects_path

          project_uuids = inertia.props[:projects].map { |p| p[:uuid] }
          expect(project_uuids).to include(project_to_restore.uuid)
        end

        it 'website file appears in code_files view' do
          # Verify the website_file was restored
          website_file = WebsiteFile.find_by(id: website_file_id)
          expect(website_file).to be_present, "WebsiteFile should be restored"
          expect(website_file.deleted_at).to be_nil, "WebsiteFile.deleted_at should be nil"

          # Check the code_files view using the same path stored in website_file
          code_file = CodeFile.find_by(website_id: website_id, path: website_file.path)
          expect(code_file).to be_present
        end
      end
    end

    context 'with campaign and ad data' do
      let!(:restore_campaign) do
        result = Campaign.create_campaign!(account, {
          name: 'Restore Campaign',
          project_id: project_to_restore.id,
          website_id: restore_website.id
        })
        result[:campaign]
      end
      let!(:restore_ad_group) { create(:ad_group, campaign: restore_campaign, name: 'Restore Ad Group') }
      let!(:restore_ad) { create(:ad, ad_group: restore_ad_group) }
      let!(:restore_ad_keyword) { create(:ad_keyword, ad_group: restore_ad_group) }
      let!(:restore_ad_headline) { create(:ad_headline, ad: restore_ad) }
      let!(:restore_ad_description) { create(:ad_description, ad: restore_ad) }

      let(:campaign_id) { restore_campaign.id }
      let(:ad_group_id) { restore_ad_group.id }
      let(:ad_id) { restore_ad.id }
      let(:ad_keyword_id) { restore_ad_keyword.id }
      let(:ad_headline_id) { restore_ad_headline.id }
      let(:ad_description_id) { restore_ad_description.id }

      before do
        # Force evaluation of campaign-related lets
        [campaign_id, ad_group_id, ad_id, ad_keyword_id, ad_headline_id, ad_description_id]

        # Soft-delete the project (cascades to campaign data)
        project_to_restore.reload.destroy

        # Restore
        patch restore_project_path(project_to_restore.uuid)
      end

      it 'restores the campaign' do
        expect(Campaign.find(campaign_id).deleted_at).to be_nil
      end

      it 'restores the ad group' do
        expect(AdGroup.find(ad_group_id).deleted_at).to be_nil
      end

      it 'restores the ad' do
        expect(Ad.find(ad_id).deleted_at).to be_nil
      end

      it 'restores the ad keyword' do
        expect(AdKeyword.find(ad_keyword_id).deleted_at).to be_nil
      end

      it 'restores the ad headline' do
        expect(AdHeadline.find(ad_headline_id).deleted_at).to be_nil
      end

      it 'restores the ad description' do
        expect(AdDescription.find(ad_description_id).deleted_at).to be_nil
      end

      it 'all ad-related models visible in default scope' do
        expect(Campaign.find_by(id: campaign_id)).to be_present
        expect(AdGroup.find_by(id: ad_group_id)).to be_present
        expect(Ad.find_by(id: ad_id)).to be_present
        expect(AdKeyword.find_by(id: ad_keyword_id)).to be_present
        expect(AdHeadline.find_by(id: ad_headline_id)).to be_present
        expect(AdDescription.find_by(id: ad_description_id)).to be_present
      end
    end

    context 'with unauthenticated user' do
      before do
        soft_delete_project!
        sign_out user
      end

      it 'returns 404 for unauthenticated requests' do
        patch restore_project_path(project_to_restore.uuid)

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'cross-account security' do
      let!(:other_user) { create(:user, name: 'Other User') }
      let!(:other_account) { other_user.owned_account }

      before do
        soft_delete_project!
        ensure_plans_exist
        subscribe_account(other_account, plan_name: 'growth_monthly')
        sign_out user
        sign_in other_user
      end

      it 'redirects when trying to restore another account project' do
        patch restore_project_path(project_to_restore.uuid)

        expect(response).to have_http_status(:redirect)
      end

      it 'does not restore the project' do
        patch restore_project_path(project_to_restore.uuid)

        expect(Project.with_deleted.find(project_id).deleted_at).to be_present
      end
    end

    context 'when project is not deleted' do
      let!(:active_project_data) do
        Brainstorm.create_brainstorm!(account, name: 'Active Project', thread_id: 'active-thread-id')
      end
      let!(:active_project) { active_project_data[:project] }

      it 'redirects for non-deleted project' do
        patch restore_project_path(active_project.uuid)

        expect(response).to have_http_status(:redirect)
      end
    end
  end
end
