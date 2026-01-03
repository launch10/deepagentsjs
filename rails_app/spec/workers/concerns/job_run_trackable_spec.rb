require 'rails_helper'

# Test worker that uses JobRunTrackable
class TestTrackableWorker
  include Sidekiq::Worker
  include JobRunTrackable

  def perform(job_run_id)
    with_job_run_tracking(job_run_id) do
      # Simulate work
      result = { test_key: "test_value" }
      complete_job_run!(result)
    end
  end
end

# Worker that fails
class FailingTrackableWorker
  include Sidekiq::Worker
  include JobRunTrackable

  def perform(job_run_id)
    with_job_run_tracking(job_run_id) do
      raise StandardError, "Intentional failure"
    end
  end
end

RSpec.describe JobRunTrackable, type: :concern do
  let(:account) { create(:account) }
  let(:job_run) { create(:job_run, :with_langgraph_callback, account: account, job_class: "TestTrackableWorker") }

  describe "#with_job_run_tracking" do
    context "when job_run exists and is pending" do
      it "claims the job and runs the block" do
        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(status: "completed")
        )

        TestTrackableWorker.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data).to eq({ "test_key" => "test_value" })
      end
    end

    context "when job_run does not exist" do
      it "returns early without error" do
        expect {
          TestTrackableWorker.new.perform(999999)
        }.not_to raise_error
      end
    end

    context "when job_run is already completed" do
      let(:job_run) { create(:job_run, :completed, account: account, job_class: "TestTrackableWorker") }

      it "returns early without processing" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)
        TestTrackableWorker.new.perform(job_run.id)
      end
    end

    context "when job_run is already failed" do
      let(:job_run) { create(:job_run, :failed, account: account, job_class: "TestTrackableWorker") }

      it "returns early without processing" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)
        TestTrackableWorker.new.perform(job_run.id)
      end
    end

    context "when job_run is already running (claimed by another worker)" do
      let(:job_run) { create(:job_run, :running, account: account, job_class: "TestTrackableWorker") }

      it "returns early without processing" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)
        TestTrackableWorker.new.perform(job_run.id)
      end
    end
  end

  describe "#claim_job_run! (atomic claim)" do
    it "uses atomic update to prevent race conditions" do
      # Create two workers trying to claim the same job
      worker1 = TestTrackableWorker.new
      TestTrackableWorker.new

      # First worker claims successfully
      expect(LanggraphCallbackWorker).to receive(:perform_async).once

      worker1.perform(job_run.id)

      # Second worker should not process (already claimed)
      job_run.reload
      expect(job_run.status).to eq("completed")
    end
  end

  describe "error handling" do
    let(:job_run) { create(:job_run, account: account, job_class: "FailingTrackableWorker", langgraph_callback_url: "http://example.com/callback") }

    it "marks the job as failed and notifies langgraph" do
      expect(LanggraphCallbackWorker).to receive(:perform_async).with(
        job_run.id,
        hash_including(status: "failed", error: "Intentional failure")
      )

      expect {
        FailingTrackableWorker.new.perform(job_run.id)
      }.to raise_error(StandardError, "Intentional failure")

      job_run.reload
      expect(job_run.status).to eq("failed")
      expect(job_run.error_message).to include("Intentional failure")
    end
  end
end
