require "rails_helper"

RSpec.describe GoogleAds::PaymentCheckWorker, type: :worker do
  let(:account) { create(:account) }
  let!(:user) { create(:user, email: "user@test.com") }
  let!(:ads_account) { create(:ads_account, :with_customer_id, account: account) }

  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "GoogleAdsPaymentCheck",
      status: "pending",
      langgraph_thread_id: "thread_123")
  end

  before do
    account.update!(owner: user)
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "configuration" do
    it "includes DeployJobHandler" do
      expect(described_class.ancestors).to include(DeployJobHandler)
    end
  end

  describe "#perform" do
    context "when no ads_account exists" do
      before do
        ads_account.destroy!
      end

      it "completes with has_payment: false" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["has_payment"]).to be false
        expect(job_run.result_data["status"]).to eq("none")
      end

      it "notifies Langgraph of the result" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "completed", result: hash_including(has_payment: false)))

        described_class.new.perform(job_run.id)
      end
    end

    context "when ads_account exists but no billing setup" do
      before do
        ads_account.update!(platform_settings: { google: { customer_id: "1234567890" } })
      end

      it "checks billing status via Google API" do
        billing_resource = instance_double(GoogleAds::Resources::Billing, has_payment?: false, status: "pending")
        allow(GoogleAds::Resources::Billing).to receive(:new).and_return(billing_resource)
        allow(billing_resource).to receive(:fetch_status)

        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["has_payment"]).to be false
        expect(job_run.result_data["status"]).to eq("pending")
      end
    end

    context "when ads_account has approved billing" do
      before do
        ads_account.update!(platform_settings: {
          google: {
            customer_id: "1234567890",
            billing_status: "approved"
          }
        })
      end

      it "completes with has_payment: true" do
        billing_resource = instance_double(GoogleAds::Resources::Billing, has_payment?: true, status: "approved")
        allow(GoogleAds::Resources::Billing).to receive(:new).and_return(billing_resource)
        allow(billing_resource).to receive(:fetch_status)

        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["has_payment"]).to be true
        expect(job_run.result_data["status"]).to eq("approved")
      end

      it "notifies Langgraph of the result" do
        billing_resource = instance_double(GoogleAds::Resources::Billing, has_payment?: true, status: "approved")
        allow(GoogleAds::Resources::Billing).to receive(:new).and_return(billing_resource)
        allow(billing_resource).to receive(:fetch_status)

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "completed", result: hash_including(has_payment: true)))

        described_class.new.perform(job_run.id)
      end
    end

    context "when an error occurs" do
      before do
        allow(GoogleAds::Resources::Billing).to receive(:new).and_raise(
          ApplicationClient::InternalError, "500 Server Error"
        )
      end

      it "does not re-raise (fails immediately, no Sidekiq retry)" do
        expect {
          described_class.new.perform(job_run.id)
        }.not_to raise_error
      end

      it "fails the job_run immediately" do
        described_class.new.perform(job_run.id)
        expect(job_run.reload.status).to eq("failed")
      end

      it "notifies Langgraph immediately" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        described_class.new.perform(job_run.id)
      end
    end

    context "when a terminal error occurs" do
      before do
        allow(GoogleAds::Resources::Billing).to receive(:new).and_raise(
          ApplicationClient::Unauthorized, "401 Unauthorized"
        )
      end

      it "does not re-raise" do
        expect {
          described_class.new.perform(job_run.id)
        }.not_to raise_error
      end

      it "fails the job_run immediately" do
        described_class.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("failed")
        expect(job_run.error_message).to include("Unauthorized")
      end

      it "notifies Langgraph of the failure" do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        described_class.new.perform(job_run.id)
      end
    end
  end
end
