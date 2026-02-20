# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  active             :boolean          default(TRUE), not null
#  current_step       :string
#  deleted_at         :datetime
#  deploy_type        :string           default("website"), not null
#  finished_at        :datetime
#  is_live            :boolean          default(FALSE)
#  stacktrace         :text
#  status             :string           default("pending"), not null
#  user_active_at     :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_deploy_id :bigint
#  project_id         :bigint           not null
#  thread_id          :string           not null
#  website_deploy_id  :bigint
#
# Indexes
#
#  index_deploys_on_active_project          (project_id,active) UNIQUE WHERE ((deleted_at IS NULL) AND (active = true))
#  index_deploys_on_campaign_deploy_id      (campaign_deploy_id)
#  index_deploys_on_deleted_at              (deleted_at)
#  index_deploys_on_deploy_type             (deploy_type)
#  index_deploys_on_finished_at             (finished_at)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_project_id              (project_id)
#  index_deploys_on_project_id_and_is_live  (project_id,is_live)
#  index_deploys_on_project_id_and_status   (project_id,status)
#  index_deploys_on_status                  (status)
#  index_deploys_on_thread_id               (thread_id)
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

  describe "thread_id" do
    it "has a thread_id after creation" do
      deploy = create(:deploy, project: project)
      expect(deploy.thread_id).to be_present
    end

    it "second deploy for the same project has its own thread_id" do
      create(:deploy, project: project, status: "completed")
      second_deploy = create(:deploy, project: project)

      expect(second_deploy.thread_id).to be_present
    end

    it "second deploy has a different thread_id than the first" do
      first_deploy = create(:deploy, project: project, status: "completed")
      second_deploy = create(:deploy, project: project)

      expect(second_deploy.thread_id).not_to eq(first_deploy.thread_id)
    end
  end

  describe "#cancel_in_progress!" do
    it "marks a pending deploy as failed with superseded reason" do
      deploy = create(:deploy, project: project, status: "pending")

      deploy.cancel_in_progress!

      expect(deploy.reload.status).to eq("failed")
      expect(deploy.stacktrace).to eq("Superseded by newer deploy")
    end

    it "marks a running deploy as failed with superseded reason" do
      deploy = create(:deploy, project: project, status: "running")

      deploy.cancel_in_progress!

      expect(deploy.reload.status).to eq("failed")
      expect(deploy.stacktrace).to eq("Superseded by newer deploy")
    end

    it "fails associated pending job_runs" do
      deploy = create(:deploy, project: project, status: "running")
      job_run = create(:job_run, deploy: deploy, account: account, status: "pending", job_class: "WebsiteDeploy")

      deploy.cancel_in_progress!

      expect(job_run.reload.status).to eq("failed")
      expect(job_run.error_message).to include("superseded")
    end

    it "fails associated running job_runs" do
      deploy = create(:deploy, project: project, status: "running")
      job_run = create(:job_run, deploy: deploy, account: account, status: "running", started_at: Time.current, job_class: "WebsiteDeploy")

      deploy.cancel_in_progress!

      expect(job_run.reload.status).to eq("failed")
    end

    it "skips associated in-progress website_deploy" do
      deploy = create(:deploy, project: project, status: "running")
      website = create(:website, account: account, project: project)
      # Insert directly to bypass before_create callbacks (file validation)
      WebsiteDeploy.insert!({
        website_id: website.id,
        status: "building",
        snapshot_id: SecureRandom.uuid,
        shasum: "abc123",
        environment: "production"
      })
      website_deploy = WebsiteDeploy.last
      deploy.update_column(:website_deploy_id, website_deploy.id)
      deploy.reload

      deploy.cancel_in_progress!

      expect(website_deploy.reload.status).to eq("skipped")
    end

    it "does nothing for already-completed deploys" do
      deploy = create(:deploy, project: project, status: "completed")

      expect { deploy.cancel_in_progress! }.not_to change { deploy.reload.attributes }
    end

    it "does nothing for already-failed deploys" do
      deploy = create(:deploy, project: project, status: "failed")

      expect { deploy.cancel_in_progress! }.not_to change { deploy.reload.attributes }
    end

    it "does not touch already-finished job_runs" do
      deploy = create(:deploy, project: project, status: "running")
      completed_jr = create(:job_run, deploy: deploy, account: account, status: "completed",
        started_at: 1.minute.ago, completed_at: Time.current, job_class: "WebsiteDeploy")

      deploy.cancel_in_progress!

      expect(completed_jr.reload.status).to eq("completed")
    end

    it "is atomic — rolls back all changes if any step fails" do
      deploy = create(:deploy, project: project, status: "running")
      job_run = create(:job_run, deploy: deploy, account: account, status: "pending", job_class: "WebsiteDeploy")

      # Force any job_run's fail! to raise, simulating a mid-transaction error
      allow_any_instance_of(JobRun).to receive(:fail!).and_raise(StandardError, "simulated failure")

      expect { deploy.cancel_in_progress! }.to raise_error(StandardError, "simulated failure")

      # Deploy status should NOT have changed — the transaction rolled back
      expect(deploy.reload.status).to eq("running")
      expect(job_run.reload.status).to eq("pending")
    end
  end

  describe "#deactivate!" do
    it "sets active to false on the deploy and its chat" do
      deploy = create(:deploy, project: project)
      chat = deploy.chat

      deploy.deactivate!

      expect(deploy.reload.active).to be false
      expect(chat.reload.active).to be false
    end

    it "handles deploys without a chat" do
      deploy = create(:deploy, project: project)
      deploy.chat.destroy!
      deploy.reload

      expect { deploy.deactivate! }.not_to raise_error
      expect(deploy.reload.active).to be false
    end

    it "cancels in-progress deploys before deactivating" do
      deploy = create(:deploy, project: project, status: "running")
      job_run = create(:job_run, deploy: deploy, account: account, status: "running",
        started_at: Time.current, job_class: "WebsiteDeploy")

      deploy.deactivate!

      expect(deploy.reload.status).to eq("failed")
      expect(deploy.stacktrace).to eq("Superseded by newer deploy")
      expect(deploy.active).to be false
      expect(job_run.reload.status).to eq("failed")
    end

    it "does not cancel completed deploys when deactivating" do
      deploy = create(:deploy, project: project, status: "completed")

      deploy.deactivate!

      expect(deploy.reload.status).to eq("completed")
      expect(deploy.active).to be false
    end
  end

  describe "active scope and lifecycle" do
    it "new deploys are active by default" do
      deploy = create(:deploy, project: project)
      expect(deploy.active).to be true
      expect(Deploy.active).to include(deploy)
    end

    it "creating a new deploy deactivates the previous one" do
      first = create(:deploy, project: project)
      second = create(:deploy, project: project)

      expect(first.reload.active).to be false
      expect(second.active).to be true
    end

    it "only one active deploy per project" do
      create(:deploy, project: project)
      create(:deploy, project: project)
      create(:deploy, project: project)

      expect(project.deploys.active.count).to eq(1)
    end

    it "creating a new deploy cancels in-progress previous deploys" do
      first = create(:deploy, project: project, status: "running")
      job_run = create(:job_run, deploy: first, account: account, status: "running",
        started_at: Time.current, job_class: "WebsiteDeploy")

      create(:deploy, project: project)

      expect(first.reload.status).to eq("failed")
      expect(first.stacktrace).to eq("Superseded by newer deploy")
      expect(job_run.reload.status).to eq("failed")
    end

    it "unique index rejects a second active deploy for the same project" do
      # The unique partial index on (project_id, active) WHERE active = true
      # is the DB-level backstop for the TOCTOU race. Verify it works.
      create(:deploy, project: project, status: "pending")

      # Bypass callbacks to simulate a raw INSERT that skips the Rails check
      expect {
        Deploy.insert!({
          project_id: project.id,
          status: "pending",
          active: true,
          thread_id: SecureRandom.uuid,
          is_live: false,
          created_at: Time.current,
          updated_at: Time.current
        })
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end

  describe "deploy chat lifecycle" do
    it "creates a chat on deploy creation" do
      deploy = create(:deploy, project: project)
      expect(deploy.chat).to be_present
      expect(deploy.chat.chat_type).to eq("deploy")
      expect(deploy.chat.thread_id).to eq(deploy.thread_id)
      expect(deploy.chat.active).to be true
    end

    it "deactivates old deploy chat when creating a new deploy" do
      first_deploy = create(:deploy, project: project)
      first_chat = first_deploy.chat

      second_deploy = create(:deploy, project: project)

      expect(first_chat.reload.active).to be false
      expect(second_deploy.chat.active).to be true
    end

    it "only one active deploy chat per project at a time" do
      create(:deploy, project: project)
      create(:deploy, project: project)
      create(:deploy, project: project)

      active_chats = project.chats.where(chat_type: "deploy", active: true)
      expect(active_chats.count).to eq(1)
    end

    it "deactivates chat when deploy is soft-deleted (not destroyed)" do
      deploy = create(:deploy, project: project)
      chat = deploy.chat

      deploy.destroy!

      expect(Chat.find_by(id: chat.id)).to be_present
      expect(chat.reload.active).to be false
    end

    it "chat stays active after deploy completes" do
      deploy = create(:deploy, project: project)
      deploy.update!(status: "completed")

      expect(deploy.chat.reload.active).to be true
    end

    it "chat stays active after deploy fails" do
      deploy = create(:deploy, project: project)
      deploy.update!(status: "failed")

      expect(deploy.chat.reload.active).to be true
    end
  end

  describe "deploy_type" do
    it "validates inclusion in DEPLOY_TYPES" do
      deploy = build(:deploy, project: project, deploy_type: "invalid")
      expect(deploy).not_to be_valid
      expect(deploy.errors[:deploy_type]).to be_present
    end

    it "defaults to website" do
      deploy = create(:deploy, project: project)
      expect(deploy.deploy_type).to eq("website")
    end

    describe "#instructions" do
      it "returns website-only instructions for website deploy type" do
        deploy = create(:deploy, project: project, deploy_type: "website")
        expect(deploy.instructions).to eq({ "website" => true })
      end

      it "returns full instructions for campaign deploy type" do
        deploy = create(:deploy, project: project, deploy_type: "campaign")
        expect(deploy.instructions).to eq({ "website" => true, "googleAds" => true })
      end
    end

    describe "#website_only?" do
      it "returns true for website deploy type" do
        expect(build(:deploy, deploy_type: "website").website_only?).to be true
      end

      it "returns false for campaign deploy type" do
        expect(build(:deploy, deploy_type: "campaign").website_only?).to be false
      end
    end

    describe "#includes_campaign?" do
      it "returns true for campaign deploy type" do
        expect(build(:deploy, deploy_type: "campaign").includes_campaign?).to be true
      end

      it "returns false for website deploy type" do
        expect(build(:deploy, deploy_type: "website").includes_campaign?).to be false
      end
    end

    describe ".ever_completed_with_deploy_type?" do
      it "returns true when a completed deploy with matching type exists" do
        create(:deploy, :website_only, project: project, status: "completed")
        expect(Deploy.ever_completed_with_deploy_type?(project, "website")).to be true
      end

      it "returns false when no completed deploy with that type exists" do
        create(:deploy, :website_only, project: project, status: "completed")
        expect(Deploy.ever_completed_with_deploy_type?(project, "campaign")).to be false
      end

      it "returns false when matching deploy exists but is not completed" do
        create(:deploy, :website_only, project: project, status: "running")
        expect(Deploy.ever_completed_with_deploy_type?(project, "website")).to be false
      end

      it "returns false when no deploys exist at all" do
        expect(Deploy.ever_completed_with_deploy_type?(project, "website")).to be false
      end

      it "scopes to the given project only" do
        other_project = create(:project, account: account)
        create(:deploy, :website_only, project: other_project, status: "completed")
        expect(Deploy.ever_completed_with_deploy_type?(project, "website")).to be false
      end

      it "returns true even when the deploy is deactivated" do
        deploy = create(:deploy, :website_only, project: project, status: "completed")
        deploy.deactivate!
        expect(Deploy.ever_completed_with_deploy_type?(project, "website")).to be true
      end
    end

    describe ".current_for scope" do
      it "finds a website deploy via :website target" do
        deploy = create(:deploy, :website_only, project: project)
        expect(Deploy.current_for(:website).last).to eq(deploy)
      end

      it "finds a campaign deploy via :website target (campaigns include website)" do
        deploy = create(:deploy, :full_deploy, project: project)
        expect(Deploy.current_for(:website).last).to eq(deploy)
      end

      it "finds a campaign deploy via :google_ads target" do
        deploy = create(:deploy, :full_deploy, project: project)
        expect(Deploy.current_for(:google_ads).last).to eq(deploy)
      end

      it "does not find a website deploy via :google_ads target" do
        create(:deploy, :website_only, project: project)
        expect(Deploy.current_for(:google_ads).last).to be_nil
      end
    end
  end

  describe "deploy_props serialization" do
    let!(:template) { create(:template) }
    let!(:website) { create(:website, account: account, project: project, template: template) }

    it "includes id, status, and current_step" do
      deploy = create(:deploy, project: project, status: "completed")

      props = project.send(:deploy_props, deploy)
      expect(props[:id]).to eq(deploy.id)
      expect(props[:status]).to eq("completed")
      expect(props).not_to have_key(:langgraph_thread_id)
    end

    it "returns nil when deploy is nil" do
      props = project.send(:deploy_props, nil)
      expect(props).to be_nil
    end
  end

  describe "#duration" do
    it "returns nil when not finished" do
      deploy = create(:deploy, project: project, status: "running")
      expect(deploy.duration).to be_nil
    end

    it "returns seconds between created_at and finished_at" do
      deploy = create(:deploy, project: project)
      deploy.update!(status: "completed")

      expect(deploy.duration).to be_a(Float).or be_a(Integer)
      expect(deploy.duration).to be >= 0
    end
  end

  describe "finished_at" do
    it "is stamped when status transitions to completed" do
      deploy = create(:deploy, project: project)
      expect(deploy.finished_at).to be_nil

      deploy.update!(status: "completed")
      expect(deploy.finished_at).to be_present
    end

    it "is stamped when status transitions to failed" do
      deploy = create(:deploy, project: project)
      deploy.update!(status: "failed")

      expect(deploy.finished_at).to be_present
    end

    it "is not overwritten on subsequent saves" do
      deploy = create(:deploy, project: project)
      deploy.update!(status: "completed")
      original_finished_at = deploy.finished_at

      deploy.update!(is_live: true)
      expect(deploy.reload.finished_at).to eq(original_finished_at)
    end

    it "is not set for non-terminal status transitions" do
      deploy = create(:deploy, project: project, status: "pending")
      deploy.update!(status: "running")

      expect(deploy.finished_at).to be_nil
    end
  end

  describe "callbacks" do
    describe "refresh_project_status on is_live change" do
      it "refreshes project status when is_live changes to true" do
        project.update_column(:status, "draft")
        deploy = create(:deploy, project: project, is_live: false)

        deploy.update!(is_live: true)

        expect(project.reload.status).to eq("live")
      end

      it "refreshes project status when is_live changes to false" do
        deploy = create(:deploy, project: project, is_live: true)
        project.update_column(:status, "live")

        deploy.update!(is_live: false)

        expect(project.reload.status).to eq("draft")
      end

      it "does not refresh project status when is_live is unchanged" do
        deploy = create(:deploy, project: project, is_live: false)
        expect(project).not_to receive(:refresh_status!)

        deploy.update!(status: "running")
      end
    end
  end
end
