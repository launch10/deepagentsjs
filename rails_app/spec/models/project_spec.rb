# == Schema Information
#
# Table name: projects
#
#  id         :bigint           not null, primary key
#  deleted_at :datetime
#  name       :string           not null
#  status     :string           default("draft"), not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_projects_on_account_id                 (account_id)
#  index_projects_on_account_id_and_created_at  (account_id,created_at)
#  index_projects_on_account_id_and_name        (account_id,name) UNIQUE WHERE (deleted_at IS NULL)
#  index_projects_on_account_id_and_status      (account_id,status)
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_deleted_at                 (deleted_at)
#  index_projects_on_name                       (name)
#  index_projects_on_status                     (status)
#  index_projects_on_updated_at                 (updated_at)
#  index_projects_on_uuid                       (uuid) UNIQUE
#
require "rails_helper"
RSpec.describe Project, type: :model do
  let!(:account) { create(:account) }
  let!(:template) { create(:template) }
  let!(:project) do
    data = Brainstorm.create_brainstorm!(account, name: "Project", thread_id: "thread_id")
    data[:project]
  end
  let!(:website) { project.website }
  let!(:campaign) do
    result = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })
    result[:campaign]
  end
  let(:workflow) do
    project.current_workflow
  end
  describe "#current_chat" do
    it "find the right chat for the current workflow" do
      project.current_workflow.advance_to(step: :brainstorm)

      expect(project.current_workflow.step).to eq "brainstorm"
      expect(project.current_chat.chat_type).to eq "brainstorm"
      expect(project.current_chat.thread_id).to eq "thread_id" # it uses provided thread_id

      workflow.next_step!

      # TODO: Update this once we build the website_building phase! This should break!
      expect(project.current_chat).to eq(project.website.chat)

      workflow.next_step!
      expect(project.current_workflow.step).to eq "ad_campaign"
      expect(project.current_chat.chat_type).to eq "ad_campaign"
    end
  end

  describe "status" do
    describe "validations" do
      it "validates status is present" do
        project.status = nil
        expect(project).not_to be_valid
        expect(project.errors[:status]).to include("can't be blank")
      end

      it "validates status is in allowed values" do
        project.status = "invalid"
        expect(project).not_to be_valid
        expect(project.errors[:status]).to include("is not included in the list")
      end

      it "allows valid statuses" do
        %w[draft paused live].each do |status|
          project.status = status
          expect(project).to be_valid
        end
      end
    end

    describe "status predicates" do
      it "#draft? returns true when status is draft" do
        project.status = "draft"
        expect(project.draft?).to be true
        expect(project.paused?).to be false
        expect(project.live?).to be false
      end

      it "#paused? returns true when status is paused" do
        project.status = "paused"
        expect(project.draft?).to be false
        expect(project.paused?).to be true
        expect(project.live?).to be false
      end

      it "#live? returns true when status is live" do
        project.status = "live"
        expect(project.draft?).to be false
        expect(project.paused?).to be false
        expect(project.live?).to be true
      end
    end

    describe "#refresh_status!" do
      context "when a deploy is live" do
        it "sets status to live" do
          project.update_column(:status, "draft")
          create(:deploy, project: project, is_live: true)

          project.refresh_status!

          expect(project.status).to eq("live")
        end

        it "is overridden by paused campaigns" do
          project.update_column(:status, "draft")
          create(:deploy, project: project, is_live: true)
          campaign.update_column(:status, "paused")

          project.refresh_status!

          expect(project.status).to eq("paused")
        end
      end

      context "when no deploy is live but campaign is paused" do
        it "sets status to paused" do
          project.update_column(:status, "draft")
          campaign.update_column(:status, "paused")

          project.refresh_status!

          expect(project.status).to eq("paused")
        end
      end

      context "when no deploy is live and no campaign is paused" do
        it "sets status to draft" do
          project.update_column(:status, "live")
          campaign.update_column(:status, "active")

          project.refresh_status!

          expect(project.status).to eq("draft")
        end
      end

      it "does not save if status unchanged" do
        project.update_column(:status, "draft")
        expect(project).not_to receive(:update_column)

        project.refresh_status!
      end
    end
  end

  describe "#to_mini_json" do
    describe "domain field" do
      context "when website has no website_urls" do
        it "returns nil for domain" do
          # Project created via Brainstorm.create_brainstorm! has no website_urls by default
          json = project.to_mini_json

          expect(json[:domain]).to be_nil
        end

        it "does not fall back to project name" do
          json = project.to_mini_json

          # Should not use project name as domain - that's not a valid domain
          expect(json[:domain]).not_to eq(project.name)
        end
      end

      context "when website has a website_url" do
        let!(:domain_record) { create(:domain, website: website, account: account, domain: "test-project.launch10.site") }
        let!(:website_url) { create(:website_url, website: website, domain: domain_record, account: account, path: "/") }

        it "returns the domain from website_url" do
          json = project.to_mini_json

          expect(json[:domain]).to eq("test-project.launch10.site")
        end
      end

      context "when website has a website_url with non-root path" do
        let!(:domain_record) { create(:domain, website: website, account: account, domain: "multi.launch10.site") }
        let!(:website_url) { create(:website_url, website: website, domain: domain_record, account: account, path: "/campaign") }

        it "returns the domain with path" do
          json = project.to_mini_json

          expect(json[:domain]).to eq("multi.launch10.site/campaign")
        end
      end
    end
  end
end
