require "rails_helper"

RSpec.describe GoogleAds::CampaignEnableWorker, type: :worker do
  let(:account) { create(:account) }
  let!(:user) { create(:user, email: "user@test.com") }
  let!(:website) { create(:website, account: account) }
  let!(:campaign) do
    create(:campaign,
      account: account,
      website: website,
      platform_settings: { google: { status: "PAUSED" } })
  end

  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "CampaignEnable",
      status: "pending",
      langgraph_thread_id: "thread_123",
      job_args: { "campaign_id" => campaign.id })
  end

  before do
    account.update!(owner: user)
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "#perform" do
    context "when campaign is already enabled" do
      before do
        campaign.update!(platform_settings: { google: { status: "ENABLED" } })
      end

      it "completes without calling CampaignDeploy" do
        allow(CampaignDeploy).to receive(:deploy)

        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["enabled"]).to be true
        expect(CampaignDeploy).not_to have_received(:deploy)
      end
    end

    context "when campaign needs to be enabled" do
      it "enables the campaign and syncs with Google" do
        campaign_deploy = instance_double(CampaignDeploy)
        allow(CampaignDeploy).to receive(:deploy).and_return(campaign_deploy)

        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["enabled"]).to be true
        expect(job_run.result_data["campaign_id"]).to eq(campaign.id)
      end

      it "updates campaign status to ENABLED" do
        allow(CampaignDeploy).to receive(:deploy)

        described_class.new.perform(job_run.id)

        campaign.reload
        expect(campaign.google_status).to eq("ENABLED")
      end

      it "notifies Langgraph of the result" do
        allow(CampaignDeploy).to receive(:deploy)

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "completed", result: hash_including(enabled: true)))

        described_class.new.perform(job_run.id)
      end
    end

    context "when an error occurs" do
      before do
        allow_any_instance_of(Campaign).to receive(:enable!).and_raise(StandardError, "Enable Error")
      end

      it "fails the job_run" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("failed")
        expect(job_run.error_message).to include("Enable Error")
      end

      it "notifies Langgraph of the failure" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        described_class.new.perform(job_run.id)
      end
    end

    context "when campaign is not found" do
      before do
        job_run.update!(job_args: { "campaign_id" => 999999 })
      end

      it "fails the job_run" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("failed")
        expect(job_run.error_message).to include("Couldn't find Campaign")
      end
    end
  end
end
