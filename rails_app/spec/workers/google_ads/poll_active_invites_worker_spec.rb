require "rails_helper"

RSpec.describe GoogleAds::PollActiveInvitesWorker, type: :worker do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }

  describe "#perform" do
    context "when there are active deploys with running invite jobs" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 1.minute.ago)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      it "enqueues PollInviteAcceptanceWorker for each active deploy" do
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_async)
          .with(job_run.id)

        described_class.new.perform
      end
    end

    context "when deploy is not in progress" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "completed",
          user_active_at: 1.minute.ago)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end

    context "when user is not recently active" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 10.minutes.ago)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end

    context "when job_run is not running" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 1.minute.ago)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "GoogleAdsInvite",
          status: "completed")
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end

    context "when job_run is not GoogleAdsInvite" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 1.minute.ago)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "CampaignDeploy",
          status: "running")
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end

    context "when there are multiple active deploys" do
      let!(:deploy1) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 1.minute.ago)
      end

      let!(:deploy2) do
        create(:deploy,
          project: create(:project, account: account),
          status: "running",
          user_active_at: 2.minutes.ago)
      end

      let!(:job_run1) do
        create(:job_run,
          account: account,
          deploy: deploy1,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      let!(:job_run2) do
        create(:job_run,
          account: account,
          deploy: deploy2,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      it "enqueues workers for all active deploys" do
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_async)
          .with(job_run1.id)
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_async)
          .with(job_run2.id)

        described_class.new.perform
      end
    end

    context "when deploy has no job_runs" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: 1.minute.ago)
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end

    context "when user_active_at is nil" do
      let!(:deploy) do
        create(:deploy,
          project: project,
          status: "running",
          user_active_at: nil)
      end

      let!(:job_run) do
        create(:job_run,
          account: account,
          deploy: deploy,
          job_class: "GoogleAdsInvite",
          status: "running")
      end

      it "does not enqueue any workers" do
        expect(GoogleAds::PollInviteAcceptanceWorker).not_to receive(:perform_async)

        described_class.new.perform
      end
    end
    context "stale job cleanup" do
      it "fails stale GoogleAdsInvite jobs" do
        job = create(:job_run,
          account: account,
          job_class: "GoogleAdsInvite",
          status: "running",
          started_at: 35.minutes.ago,
          langgraph_thread_id: "thread_123")

        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")

        described_class.new.perform

        job.reload
        expect(job.status).to eq("failed")
        expect(job.error_message).to include("timed out")
      end

      it "does not fail GoogleOAuthConnect jobs" do
        job = create(:job_run,
          account: account,
          job_class: "GoogleOAuthConnect",
          status: "running",
          started_at: 35.minutes.ago,
          langgraph_thread_id: "thread_456")

        described_class.new.perform

        expect(job.reload.status).to eq("running")
      end
    end
  end
end
