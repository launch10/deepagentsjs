require "rails_helper"

RSpec.describe GoogleAds::PollInviteAcceptanceWorker, type: :worker do
  let(:account) { create(:account) }
  let!(:ads_account) { create(:ads_account, :with_customer_id, account: account) }
  let!(:invitation) do
    create(:ads_account_invitation,
      ads_account: ads_account,
      platform: "google",
      email_address: "test@gmail.com",
      platform_settings: { google: { status: "sent" } })
  end

  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "GoogleAdsInvite",
      status: "running",
      langgraph_thread_id: "thread_123")
  end

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "#perform" do
    context "when job_run is not found" do
      it "returns early without error" do
        expect {
          described_class.new.perform(999)
        }.not_to raise_error
      end
    end

    context "when job_run is not running" do
      before { job_run.update!(status: "completed") }

      it "returns early without processing" do
        expect_any_instance_of(AdsAccountInvitation).not_to receive(:google_refresh_status)

        described_class.new.perform(job_run.id)
      end
    end

    context "when invitation is accepted" do
      before do
        allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
        invitation.update!(platform_settings: { google: { status: "accepted" } })
      end

      it "completes the job_run with accepted status" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data).to eq({ "status" => "accepted" })
      end

      it "notifies Langgraph of completion" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(
            status: "completed",
            result: { status: "accepted" }
          ))

        described_class.new.perform(job_run.id)
      end
    end

    context "when invitation is still pending" do
      before do
        allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
      end

      it "does not complete the job_run" do
        described_class.new.perform(job_run.id)

        expect(job_run.reload.status).to eq("running")
      end

      it "does not notify Langgraph" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        described_class.new.perform(job_run.id)
      end
    end

    context "when no invitation exists" do
      before { invitation.destroy }

      it "refreshes status on nil invitation without error" do
        expect {
          described_class.new.perform(job_run.id)
        }.not_to raise_error
      end

      it "leaves job_run running" do
        described_class.new.perform(job_run.id)

        expect(job_run.reload.status).to eq("running")
      end
    end
  end
end
