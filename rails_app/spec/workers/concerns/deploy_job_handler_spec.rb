require "rails_helper"

# Test worker that includes the concern
class TestDeployWorker
  include Sidekiq::Worker
  include DeployJobHandler

  sidekiq_options queue: :default, retry: 3

  def perform(job_run_id)
    job_run = JobRun.find(job_run_id)
    job_run.start!
    # Simulate work...
    raise StandardError, "something broke"
  rescue => e
    handle_deploy_error(job_run, e)
  end
end

RSpec.describe DeployJobHandler, type: :worker do
  let(:account) { create(:account) }
  let!(:user) { create(:user, email: "handler-test@test.com") }
  let(:job_run) do
    create(:job_run,
      account: account,
      job_class: "CampaignEnable",
      status: "pending",
      langgraph_thread_id: "thread_123")
  end

  before do
    account.update!(owner: user)
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
  end

  describe "#handle_deploy_error" do
    context "with any error (api_outage)" do
      let(:error) { ApplicationClient::InternalError.new("500 Server Error") }

      it "does not re-raise (fails immediately, no Sidekiq retry)" do
        job_run.start!
        worker = TestDeployWorker.new

        expect {
          worker.send(:handle_deploy_error, job_run, error)
        }.not_to raise_error
      end

      it "fails the job_run immediately" do
        job_run.start!
        worker = TestDeployWorker.new
        worker.send(:handle_deploy_error, job_run, error)

        expect(job_run.reload.status).to eq("failed")
      end

      it "notifies Langgraph immediately" do
        job_run.start!
        worker = TestDeployWorker.new

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        worker.send(:handle_deploy_error, job_run, error)
      end

      it "persists error_type on job_run" do
        job_run.start!
        worker = TestDeployWorker.new

        allow(LanggraphCallbackWorker).to receive(:perform_async)

        worker.send(:handle_deploy_error, job_run, error)

        expect(job_run.reload.error_type).to eq("api_outage")
      end
    end

    context "with auth_failure" do
      let(:error) { ApplicationClient::Unauthorized.new("401 Unauthorized") }

      it "fails immediately and notifies" do
        job_run.start!
        worker = TestDeployWorker.new

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        expect {
          worker.send(:handle_deploy_error, job_run, error)
        }.not_to raise_error

        expect(job_run.reload.status).to eq("failed")
      end
    end

    context "with not_found" do
      let(:error) { ActiveRecord::RecordNotFound.new("Couldn't find Campaign") }

      it "fails immediately and notifies" do
        job_run.start!
        worker = TestDeployWorker.new

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        expect {
          worker.send(:handle_deploy_error, job_run, error)
        }.not_to raise_error

        expect(job_run.reload.status).to eq("failed")
      end
    end

    context "with timeout" do
      let(:error) { Timeout::Error.new("execution expired") }

      it "fails immediately (no Sidekiq retry)" do
        job_run.start!
        worker = TestDeployWorker.new

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed"))

        expect {
          worker.send(:handle_deploy_error, job_run, error)
        }.not_to raise_error

        expect(job_run.reload.status).to eq("failed")
      end
    end

    context "when job_run is already finished" do
      it "does not update job_run or notify" do
        job_run.update!(status: "completed", completed_at: Time.current)
        error = ApplicationClient::Unauthorized.new("401")
        worker = TestDeployWorker.new

        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        expect {
          worker.send(:handle_deploy_error, job_run, error)
        }.not_to raise_error
      end
    end
  end

  describe "sidekiq_retries_exhausted" do
    it "fails the job_run and notifies Langgraph" do
      ex = StandardError.new("Final failure")
      msg = { "args" => [job_run.id], "retry_count" => 3 }

      expect(LanggraphCallbackWorker).to receive(:perform_async)
        .with(job_run.id, hash_including(status: "failed", error: "Final failure"))

      TestDeployWorker.sidekiq_retries_exhausted_block.call(msg, ex)

      expect(job_run.reload.status).to eq("failed")
    end

    it "persists error_type on job_run" do
      ex = Errno::ECONNREFUSED.new("Connection refused")
      msg = { "args" => [job_run.id], "retry_count" => 3 }

      allow(LanggraphCallbackWorker).to receive(:perform_async)

      TestDeployWorker.sidekiq_retries_exhausted_block.call(msg, ex)

      expect(job_run.reload.error_type).to eq("api_outage")
    end

    it "does not update already-finished job_run" do
      job_run.update!(status: "completed", completed_at: Time.current)
      ex = StandardError.new("Late failure")
      msg = { "args" => [job_run.id], "retry_count" => 3 }

      expect(LanggraphCallbackWorker).not_to receive(:perform_async)

      TestDeployWorker.sidekiq_retries_exhausted_block.call(msg, ex)

      expect(job_run.reload.status).to eq("completed")
    end
  end
end
