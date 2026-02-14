require "rails_helper"

RSpec.describe Monitoring::StuckJobDetectorWorker, type: :worker do
  let(:account) { create(:account) }

  describe "#perform" do
    context "with stuck pending job runs" do
      it "marks them failed and fires the failed webhook" do
        stuck_job = create(:job_run, :pending, :with_langgraph_callback,
          account: account, created_at: 15.minutes.ago)

        expect(Rollbar).to receive(:error).with(
          "Stuck job run detected",
          hash_including(job_run_id: stuck_job.id, status: "pending")
        )

        described_class.new.perform

        stuck_job.reload
        expect(stuck_job.status).to eq("failed")
        expect(stuck_job.error_message).to match(/stuck/i)
        expect(LanggraphCallbackWorker.jobs.size).to eq(1)
      end
    end

    context "with stuck running job runs" do
      it "marks them failed and fires the failed webhook" do
        stuck_job = create(:job_run, :running, :with_langgraph_callback,
          account: account, created_at: 15.minutes.ago)

        expect(Rollbar).to receive(:error).with(
          "Stuck job run detected",
          hash_including(job_run_id: stuck_job.id, status: "running")
        )

        described_class.new.perform

        stuck_job.reload
        expect(stuck_job.status).to eq("failed")
        expect(LanggraphCallbackWorker.jobs.size).to eq(1)
      end
    end

    context "with recent job runs" do
      it "ignores them" do
        recent_pending = create(:job_run, :pending, account: account, created_at: 2.minutes.ago)
        recent_running = create(:job_run, :running, account: account, created_at: 5.minutes.ago)

        expect(Rollbar).not_to receive(:error)

        described_class.new.perform

        expect(recent_pending.reload.status).to eq("pending")
        expect(recent_running.reload.status).to eq("running")
      end
    end

    context "with completed/failed job runs" do
      it "ignores them" do
        create(:job_run, :completed, account: account, created_at: 15.minutes.ago)
        create(:job_run, :failed, account: account, created_at: 15.minutes.ago)

        expect(Rollbar).not_to receive(:error)

        described_class.new.perform
      end
    end

    context "with stuck jobs without langgraph callback" do
      it "marks them failed but does not enqueue callback" do
        stuck_job = create(:job_run, :pending,
          account: account, created_at: 15.minutes.ago, langgraph_thread_id: nil)

        expect(Rollbar).to receive(:error)

        described_class.new.perform

        stuck_job.reload
        expect(stuck_job.status).to eq("failed")
        expect(LanggraphCallbackWorker.jobs.size).to eq(0)
      end
    end
  end
end
