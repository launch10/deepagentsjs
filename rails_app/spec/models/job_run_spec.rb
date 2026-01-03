# == Schema Information
#
# Table name: job_runs
#
#  id                     :bigint           not null, primary key
#  completed_at           :datetime
#  error_message          :text
#  job_args               :jsonb
#  job_class              :string           not null
#  langgraph_callback_url :string
#  result_data            :jsonb
#  started_at             :datetime
#  status                 :string           default("pending"), not null
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  account_id             :bigint
#  langgraph_thread_id    :string
#
require 'rails_helper'

RSpec.describe JobRun, type: :model do
  let(:account) { create(:account) }

  describe "associations" do
    it { should belong_to(:account) }
  end

  describe "validations" do
    it { should validate_presence_of(:job_class) }
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(JobRun::STATUSES) }
    it { should validate_presence_of(:account) }
  end

  describe "scopes" do
    let!(:pending_job) { create(:job_run, account: account, status: "pending") }
    let!(:running_job) { create(:job_run, account: account, status: "running") }
    let!(:completed_job) { create(:job_run, account: account, status: "completed") }
    let!(:failed_job) { create(:job_run, account: account, status: "failed") }

    describe ".pending" do
      it "returns only pending job runs" do
        expect(JobRun.pending).to contain_exactly(pending_job)
      end
    end

    describe ".running" do
      it "returns only running job runs" do
        expect(JobRun.running).to contain_exactly(running_job)
      end
    end

    describe ".completed" do
      it "returns only completed job runs" do
        expect(JobRun.completed).to contain_exactly(completed_job)
      end
    end

    describe ".failed" do
      it "returns only failed job runs" do
        expect(JobRun.failed).to contain_exactly(failed_job)
      end
    end

    describe ".for_job" do
      let!(:specific_job) { create(:job_run, account: account, job_class: "SpecificJob") }

      it "returns job runs for the specified job class" do
        expect(JobRun.for_job("SpecificJob")).to contain_exactly(specific_job)
      end
    end

    describe ".recent" do
      it "orders job runs by created_at desc" do
        expect(JobRun.recent.first).to eq(failed_job)
      end
    end
  end

  describe "#start!" do
    let(:job_run) { create(:job_run, account: account, status: "pending") }

    it "updates status to running and sets started_at" do
      Timecop.freeze do
        job_run.start!
        expect(job_run.status).to eq("running")
        expect(job_run.started_at).to eq(Time.current)
      end
    end
  end

  describe "#complete!" do
    let(:job_run) { create(:job_run, account: account, status: "running") }

    context "without result" do
      it "updates status to completed and sets completed_at" do
        Timecop.freeze do
          job_run.complete!
          expect(job_run.status).to eq("completed")
          expect(job_run.completed_at).to eq(Time.current)
        end
      end
    end

    context "with result" do
      it "stores the result_data" do
        result = { campaign_id: 123, external_id: "abc123" }
        job_run.complete!(result)
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data).to eq(result.stringify_keys)
      end
    end
  end

  describe "#fail!" do
    let(:job_run) { create(:job_run, account: account, status: "running") }

    context "with a string error" do
      it "stores the error message" do
        job_run.fail!("Something went wrong")
        expect(job_run.status).to eq("failed")
        expect(job_run.error_message).to eq("Something went wrong")
      end
    end

    context "with an exception" do
      it "formats the exception properly" do
        error = StandardError.new("Test error")
        job_run.fail!(error)
        expect(job_run.error_message).to eq("StandardError: Test error")
      end
    end
  end

  describe "#notify_langgraph" do
    let(:job_run) do
      create(:job_run,
        account: account,
        langgraph_callback_url: "http://localhost:4000/webhooks/job_run_callback",
        langgraph_thread_id: "thread_123")
    end

    context "with a callback URL" do
      it "enqueues a LanggraphCallbackWorker" do
        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(
            job_run_id: job_run.id,
            thread_id: "thread_123",
            status: "completed"
          )
        )

        job_run.notify_langgraph(status: "completed", result: { success: true })
      end
    end

    context "without a callback URL" do
      let(:job_run) { create(:job_run, account: account, langgraph_callback_url: nil) }

      it "does not enqueue a worker" do
        expect(LanggraphCallbackWorker).not_to receive(:perform_async)
        job_run.notify_langgraph(status: "completed")
      end
    end
  end

  describe "status predicates" do
    let(:job_run) { create(:job_run, account: account, status: "pending") }

    it "#pending? returns true for pending status" do
      expect(job_run.pending?).to be true
      expect(job_run.running?).to be false
    end

    it "#running? returns true for running status" do
      job_run.update!(status: "running")
      expect(job_run.running?).to be true
      expect(job_run.pending?).to be false
    end

    it "#completed? returns true for completed status" do
      job_run.update!(status: "completed")
      expect(job_run.completed?).to be true
    end

    it "#failed? returns true for failed status" do
      job_run.update!(status: "failed")
      expect(job_run.failed?).to be true
    end

    it "#finished? returns true for completed or failed" do
      job_run.update!(status: "completed")
      expect(job_run.finished?).to be true

      job_run.update!(status: "failed")
      expect(job_run.finished?).to be true

      job_run.update!(status: "running")
      expect(job_run.finished?).to be false
    end
  end

  describe "#duration" do
    let(:job_run) { create(:job_run, account: account) }

    context "when both started_at and completed_at are set" do
      it "returns the duration in seconds" do
        job_run.update!(
          started_at: Time.current - 5.minutes,
          completed_at: Time.current
        )
        expect(job_run.duration).to be_within(1).of(300)
      end
    end

    context "when started_at is nil" do
      it "returns nil" do
        job_run.update!(completed_at: Time.current)
        expect(job_run.duration).to be_nil
      end
    end

    context "when completed_at is nil" do
      it "returns nil" do
        job_run.update!(started_at: Time.current)
        expect(job_run.duration).to be_nil
      end
    end
  end
end
