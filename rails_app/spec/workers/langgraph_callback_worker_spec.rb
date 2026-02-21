require "rails_helper"

RSpec.describe LanggraphCallbackWorker, type: :worker do
  let(:account) { create(:account) }
  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "WebsiteDeploy",
      status: "completed",
      langgraph_thread_id: "thread_123")
  end

  let(:payload) do
    { "job_run_id" => job_run.id, "status" => "completed", "result" => { "ok" => true } }
  end

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "configuration" do
    it "has 15 retries" do
      expect(described_class.sidekiq_options["retry"]).to eq(15)
    end

    it "uses exponential backoff capped at 4 hours" do
      # retry 0: 5s, 1: 15s, 2: 45s, 3: 135s, ...
      retry_in = described_class.sidekiq_retry_in_block.call(0)
      expect(retry_in).to eq(5)

      retry_in = described_class.sidekiq_retry_in_block.call(1)
      expect(retry_in).to eq(15)

      retry_in = described_class.sidekiq_retry_in_block.call(2)
      expect(retry_in).to eq(45)

      # High retry counts cap at 14400 (4 hours)
      retry_in = described_class.sidekiq_retry_in_block.call(10)
      expect(retry_in).to eq(14_400)
    end
  end

  describe "#perform" do
    context "when job_run exists and has callback URL" do
      it "delivers the payload via LanggraphCallbackClient" do
        client = instance_double(LanggraphCallbackClient)
        allow(LanggraphCallbackClient).to receive(:new)
          .with(callback_url: "http://localhost:4000/webhooks/job_run_callback")
          .and_return(client)
        expect(client).to receive(:deliver).with(payload.deep_symbolize_keys)

        described_class.new.perform(job_run.id, payload)
      end
    end

    context "when job_run does not exist" do
      it "returns early without error" do
        expect {
          described_class.new.perform(999999, payload)
        }.not_to raise_error
      end
    end

    context "when callback URL is not configured" do
      before do
        allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return(nil)
      end

      it "returns early without error" do
        expect(LanggraphCallbackClient).not_to receive(:new)

        expect {
          described_class.new.perform(job_run.id, payload)
        }.not_to raise_error
      end
    end

    context "when delivery fails" do
      it "re-raises ApplicationClient::Error for Sidekiq retry" do
        client = instance_double(LanggraphCallbackClient)
        allow(LanggraphCallbackClient).to receive(:new).and_return(client)
        allow(client).to receive(:deliver).and_raise(ApplicationClient::Error, "Connection failed")

        expect {
          described_class.new.perform(job_run.id, payload)
        }.to raise_error(ApplicationClient::Error, "Connection failed")
      end
    end
  end

  describe "sidekiq_retries_exhausted" do
    it "logs the failure" do
      msg = { "args" => [job_run.id], "retry_count" => 15 }
      ex = ApplicationClient::Error.new("Connection failed")

      expect(Rails.logger).to receive(:error).with(/Webhook delivery permanently failed/)

      described_class.sidekiq_retries_exhausted_block.call(msg, ex)
    end
  end
end
