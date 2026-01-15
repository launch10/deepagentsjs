require "rails_helper"

RSpec.describe GoogleAds::SendInviteWorker, type: :worker do
  let(:account) { create(:account) }
  let!(:user) { create(:user, email: "user@test.com") }
  let!(:connected_account) do
    create(:connected_account,
      owner: user,
      provider: "google_oauth2",
      auth: { "info" => { "email" => "test@gmail.com" } })
  end

  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "GoogleAdsInvite",
      status: "pending",
      langgraph_thread_id: "thread_123")
  end

  before do
    # Set up account owner and connected account
    account.update!(owner: user)
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "#perform" do
    context "when ads_account does not exist" do
      it "creates a new ads_account for the account" do
        ads_account = instance_double(AdsAccount,
          google_synced?: true,
          send_google_ads_invitation_email: true)
        allow(account).to receive_message_chain(:ads_account).and_return(nil, ads_account)
        allow(account).to receive(:create_ads_account!).and_return(ads_account)

        allow(JobRun).to receive(:find).with(job_run.id).and_return(job_run)
        allow(job_run).to receive(:account).and_return(account)
        allow(job_run).to receive(:start!)

        expect(account).to receive(:create_ads_account!).with(platform: "google")
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_in).with(30.seconds, job_run.id, attempts: 0)

        described_class.new.perform(job_run.id)
      end
    end

    context "when ads_account exists but not synced" do
      let!(:ads_account) { create(:ads_account, :with_customer_id, account: account) }

      before do
        allow_any_instance_of(AdsAccount).to receive(:google_synced?).and_return(false)
        allow_any_instance_of(AdsAccount).to receive(:google_sync).and_return(true)
        allow_any_instance_of(AdsAccount).to receive(:send_google_ads_invitation_email).and_return(true)
      end

      it "syncs the ads_account before sending invite" do
        expect_any_instance_of(AdsAccount).to receive(:google_sync)
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_in)

        described_class.new.perform(job_run.id)
      end
    end

    context "when ads_account is synced" do
      let!(:ads_account) { create(:ads_account, :with_customer_id, account: account) }

      before do
        allow_any_instance_of(AdsAccount).to receive(:google_synced?).and_return(true)
        allow_any_instance_of(AdsAccount).to receive(:send_google_ads_invitation_email).and_return(true)
      end

      it "marks the job_run as running" do
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_in)

        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("running")
        expect(job_run.started_at).to be_present
      end

      it "sends the Google Ads invitation email" do
        expect_any_instance_of(AdsAccount).to receive(:send_google_ads_invitation_email)
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_in)

        described_class.new.perform(job_run.id)
      end

      it "enqueues the poll worker for 30 seconds later" do
        expect(GoogleAds::PollInviteAcceptanceWorker).to receive(:perform_in)
          .with(30.seconds, job_run.id, attempts: 0)

        described_class.new.perform(job_run.id)
      end
    end

    context "when an error occurs" do
      let!(:ads_account) { create(:ads_account, :with_customer_id, account: account) }

      before do
        allow_any_instance_of(AdsAccount).to receive(:google_synced?).and_raise(StandardError, "API Error")
      end

      it "fails the job_run" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("failed")
        expect(job_run.error_message).to include("API Error")
      end

      it "notifies Langgraph of the failure" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        described_class.new.perform(job_run.id)
      end
    end
  end
end
