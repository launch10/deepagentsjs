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
          described_class.new.perform(999, "attempts" => 0)
        }.not_to raise_error
      end
    end

    context "when job_run is not running" do
      before { job_run.update!(status: "completed") }

      it "returns early without processing" do
        expect_any_instance_of(AdsAccountInvitation).not_to receive(:google_refresh_status)

        described_class.new.perform(job_run.id, "attempts" => 0)
      end
    end

    context "when invitation is accepted" do
      before do
        allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
        invitation.update!(platform_settings: { google: { status: "accepted" } })
      end

      it "completes the job_run with accepted status" do
        described_class.new.perform(job_run.id, "attempts" => 0)

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

        described_class.new.perform(job_run.id, "attempts" => 0)
      end
    end

    context "when invitation is still pending" do
      before do
        allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
      end

      it "re-enqueues itself for 30 seconds later with incremented attempts" do
        expect(described_class).to receive(:perform_in)
          .with(30.seconds, job_run.id, attempts: 1)

        described_class.new.perform(job_run.id, "attempts" => 0)
      end

      it "does not complete the job_run" do
        allow(described_class).to receive(:perform_in)

        described_class.new.perform(job_run.id, "attempts" => 0)

        expect(job_run.reload.status).to eq("running")
      end
    end

    context "when max attempts reached" do
      before do
        allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
      end

      it "does not re-enqueue itself" do
        expect(described_class).not_to receive(:perform_in)

        described_class.new.perform(job_run.id, "attempts" => 10)
      end

      it "does not fail the job_run (user can re-trigger)" do
        described_class.new.perform(job_run.id, "attempts" => 10)

        expect(job_run.reload.status).to eq("running")
      end
    end

    context "when no invitation exists" do
      before { invitation.destroy }

      it "refreshes status on nil invitation without error" do
        allow(described_class).to receive(:perform_in)

        expect {
          described_class.new.perform(job_run.id, "attempts" => 0)
        }.not_to raise_error
      end
    end
  end
end
