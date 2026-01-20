# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  current_step       :string
#  is_live            :boolean          default(FALSE)
#  stacktrace         :text
#  status             :string           default("pending"), not null
#  user_active_at     :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_deploy_id :bigint
#  project_id         :bigint           not null
#  website_deploy_id  :bigint
#
# Indexes
#
#  index_deploys_on_campaign_deploy_id      (campaign_deploy_id)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_project_id              (project_id)
#  index_deploys_on_project_id_and_is_live  (project_id,is_live)
#  index_deploys_on_project_id_and_status   (project_id,status)
#  index_deploys_on_status                  (status)
#  index_deploys_on_website_deploy_id       (website_deploy_id)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_deploy_id => campaign_deploys.id)
#  fk_rails_...  (project_id => projects.id)
#  fk_rails_...  (website_deploy_id => website_deploys.id)
#
require "rails_helper"

RSpec.describe Deploy, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }

  describe "validations" do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(Deploy::STATUS) }
  end

  describe "associations" do
    it { should belong_to(:project) }
    it { should belong_to(:website_deploy).class_name("WebsiteDeploy").optional }
    it { should belong_to(:campaign_deploy).optional }
  end

  describe "statuses" do
    it "has the same statuses as WebsiteDeploy" do
      expect(Deploy::STATUS).to eq(%w[pending running completed failed])
    end
  end

  describe "scopes" do
    describe ".live" do
      it "returns deploys with is_live true" do
        live_deploy = create(:deploy, project: project, is_live: true)
        not_live = create(:deploy, project: project, is_live: false)

        expect(Deploy.live).to include(live_deploy)
        expect(Deploy.live).not_to include(not_live)
      end
    end

    describe ".in_progress" do
      it "returns deploys with pending status" do
        pending_deploy = create(:deploy, project: project, status: "pending")
        expect(Deploy.in_progress).to include(pending_deploy)
      end

      it "returns deploys with running status" do
        running_deploy = create(:deploy, project: project, status: "running")
        expect(Deploy.in_progress).to include(running_deploy)
      end

      it "does not return completed deploys" do
        completed_deploy = create(:deploy, project: project, status: "completed")
        expect(Deploy.in_progress).not_to include(completed_deploy)
      end

      it "does not return failed deploys" do
        failed_deploy = create(:deploy, project: project, status: "failed")
        expect(Deploy.in_progress).not_to include(failed_deploy)
      end
    end
  end

  describe "factory" do
    it "creates a valid deploy" do
      deploy = build(:deploy, project: project)
      expect(deploy).to be_valid
    end

    it "defaults to pending status" do
      deploy = create(:deploy, project: project)
      expect(deploy.status).to eq("pending")
    end

    it "defaults is_live to false" do
      deploy = create(:deploy, project: project)
      expect(deploy.is_live).to be false
    end
  end

  describe "project association" do
    it "can access deploys through project" do
      deploy = create(:deploy, project: project)
      expect(project.deploys).to include(deploy)
    end
  end

  describe "Project#active_deploy" do
    context "when there is an in-progress deploy" do
      it "returns the most recent in-progress deploy" do
        create(:deploy, project: project, status: "pending", created_at: 1.hour.ago)
        new_pending = create(:deploy, project: project, status: "pending", created_at: Time.current)

        expect(project.active_deploy).to eq(new_pending)
      end

      it "prefers in-progress over completed deploys" do
        create(:deploy, project: project, status: "completed", created_at: Time.current)
        in_progress = create(:deploy, project: project, status: "running", created_at: 1.hour.ago)

        expect(project.active_deploy).to eq(in_progress)
      end
    end

    context "when there is no in-progress deploy" do
      it "returns the most recent deploy" do
        create(:deploy, project: project, status: "completed", created_at: 1.hour.ago)
        new_completed = create(:deploy, project: project, status: "completed", created_at: Time.current)

        expect(project.active_deploy).to eq(new_completed)
      end
    end

    context "when there are no deploys" do
      it "returns nil" do
        expect(project.active_deploy).to be_nil
      end
    end
  end

  describe "Project#live_deploy" do
    it "returns the most recent live deploy" do
      create(:deploy, project: project, is_live: true, status: "completed", created_at: 1.hour.ago)
      new_live = create(:deploy, project: project, is_live: true, status: "completed", created_at: Time.current)
      create(:deploy, project: project, is_live: false, status: "completed")

      expect(project.live_deploy).to eq(new_live)
    end

    it "returns nil when no live deploy exists" do
      create(:deploy, project: project, is_live: false)

      expect(project.live_deploy).to be_nil
    end
  end
end
