require "rails_helper"

RSpec.describe Monitoring::StuckJobDetectorWorker, type: :worker do
  let(:account) { create(:account) }

  describe "#perform" do
    context "with stuck pending job runs" do
      it "marks them failed and fires the failed webhook" do
        stuck_job = create(:job_run, :pending, :with_langgraph_callback,
          account: account, created_at: 15.minutes.ago)

        expect(Sentry).to receive(:capture_message).with(
          "Stuck job run detected",
          extra: hash_including(job_run_id: stuck_job.id, status: "pending")
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

        expect(Sentry).to receive(:capture_message).with(
          "Stuck job run detected",
          extra: hash_including(job_run_id: stuck_job.id, status: "running")
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

        expect(Sentry).not_to receive(:capture_message)

        described_class.new.perform

        expect(recent_pending.reload.status).to eq("pending")
        expect(recent_running.reload.status).to eq("running")
      end
    end

    context "with completed/failed job runs" do
      it "ignores them" do
        create(:job_run, :completed, account: account, created_at: 15.minutes.ago)
        create(:job_run, :failed, account: account, created_at: 15.minutes.ago)

        expect(Sentry).not_to receive(:capture_message)

        described_class.new.perform
      end
    end

    context "with stuck jobs without langgraph callback" do
      it "marks them failed but does not enqueue callback" do
        stuck_job = create(:job_run, :pending,
          account: account, created_at: 15.minutes.ago, langgraph_thread_id: nil)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected", anything)

        described_class.new.perform

        stuck_job.reload
        expect(stuck_job.status).to eq("failed")
        expect(LanggraphCallbackWorker.jobs.size).to eq(0)
      end
    end

    context "with jobs older than 10 minutes" do
      it "marks GoogleOAuthConnect as stuck" do
        job = create(:job_run, :pending, :with_langgraph_callback, account: account,
          job_class: "GoogleOAuthConnect", created_at: 30.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected",
          extra: hash_including(job_run_id: job.id))

        described_class.new.perform

        expect(job.reload.status).to eq("failed")
      end

      it "marks GoogleAdsInvite as stuck" do
        job = create(:job_run, :running, :with_langgraph_callback, account: account,
          job_class: "GoogleAdsInvite", created_at: 1.hour.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected",
          extra: hash_including(job_run_id: job.id))

        described_class.new.perform

        expect(job.reload.status).to eq("failed")
      end

      it "marks GoogleAdsPaymentCheck as stuck" do
        job = create(:job_run, :running, :with_langgraph_callback, account: account,
          job_class: "GoogleAdsPaymentCheck", created_at: 20.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected",
          extra: hash_including(job_run_id: job.id))

        described_class.new.perform

        expect(job.reload.status).to eq("failed")
      end
    end

    context "support ticket creation" do
      it "creates a support ticket for stuck jobs with a deploy" do
        deploy = create(:deploy, :running, project: create(:project, account: account))
        create(:job_run, :pending, :with_langgraph_callback,
          account: account, deploy: deploy, created_at: 15.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected", anything)
          .and_return(double(event_id: "stuck-job-event-id"))

        expect { described_class.new.perform }.to change(SupportRequest, :count).by(1)

        ticket = SupportRequest.last
        expect(ticket.supportable).to eq(deploy)
        expect(ticket.subject).to include("Deploy ##{deploy.id} failed")
        expect(ticket.description).to include("Sentry: https://sentry.io/organizations/launch10/issues/?query=stuck-job-event-id")
      end

      it "does not create a support ticket for stuck jobs without a deploy" do
        create(:job_run, :pending, :with_langgraph_callback,
          account: account, deploy: nil, created_at: 15.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected", anything)
          .and_return(double(event_id: "stuck-job-event-id"))

        expect { described_class.new.perform }.not_to change(SupportRequest, :count)
      end

      it "does not duplicate tickets if one already exists" do
        deploy = create(:deploy, :running, project: create(:project, account: account))
        create(:support_request, supportable: deploy, user: account.owner, account: account)
        create(:job_run, :pending, :with_langgraph_callback,
          account: account, deploy: deploy, created_at: 15.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected", anything)
          .and_return(double(event_id: "stuck-job-event-id"))

        expect { described_class.new.perform }.not_to change(SupportRequest, :count)
      end

      it "logs error if support ticket creation fails but does not raise" do
        deploy = create(:deploy, :running, project: create(:project, account: account))
        stuck_job = create(:job_run, :pending, :with_langgraph_callback,
          account: account, deploy: deploy, created_at: 15.minutes.ago)

        expect(Sentry).to receive(:capture_message).with("Stuck job run detected", anything)
          .and_return(double(event_id: "stuck-job-event-id"))
        allow(Deploys::AutoSupportTicketService).to receive_message_chain(:new, :call)
          .and_raise(StandardError, "ticket creation failed")
        expect(Sentry).to receive(:capture_message).with(
          "Failed to create support ticket for stuck job",
          extra: hash_including(job_run_id: stuck_job.id)
        )

        expect { described_class.new.perform }.not_to raise_error
      end
    end
  end
end
