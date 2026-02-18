require "rails_helper"

RSpec.describe Monitoring::StuckDeployDetectorWorker, type: :worker do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }

  describe "#perform" do
    context "with a stuck deploy (running, >15 min old)" do
      it "marks it failed, sets stacktrace, and creates a support ticket" do
        deploy = create(:deploy, :running, project: project, created_at: 20.minutes.ago)

        expect(Rollbar).to receive(:error).with(
          "Stuck deploy detected",
          hash_including(deploy_id: deploy.id, status: "running")
        ).and_return({"uuid" => "stuck-deploy-uuid"})

        expect { described_class.new.perform }.to change(SupportRequest, :count).by(1)

        deploy.reload
        expect(deploy.status).to eq("failed")
        expect(deploy.stacktrace).to eq(described_class::STUCK_ERROR)
        expect(deploy.finished_at).to be_present

        ticket = SupportRequest.last
        expect(ticket.supportable).to eq(deploy)
        expect(ticket.subject).to include("Deploy ##{deploy.id} failed")
        expect(ticket.description).to include("Rollbar: https://rollbar.com/occurrence/uuid/?uuid=stuck-deploy-uuid")
      end
    end

    context "with a stuck pending deploy (>15 min old)" do
      it "marks it failed" do
        deploy = create(:deploy, project: project, status: "pending", created_at: 20.minutes.ago)

        expect(Rollbar).to receive(:error).with(
          "Stuck deploy detected",
          hash_including(deploy_id: deploy.id, status: "pending")
        ).and_return({})
        # AutoSupportTicketService also calls Rollbar.error when no rollbar_uuid
        allow(Rollbar).to receive(:error).with(/Deploy #/, anything).and_return({})

        described_class.new.perform

        deploy.reload
        expect(deploy.status).to eq("failed")
        expect(deploy.finished_at).to be_present
      end
    end

    context "with a recent deploy (running, <15 min old)" do
      it "leaves it alone" do
        deploy = create(:deploy, :running, project: project, created_at: 5.minutes.ago)

        expect(Rollbar).not_to receive(:error)

        described_class.new.perform

        expect(deploy.reload.status).to eq("running")
      end
    end

    context "with a completed deploy" do
      it "leaves it alone" do
        deploy = create(:deploy, :completed, project: project, created_at: 20.minutes.ago)

        expect(Rollbar).not_to receive(:error)

        described_class.new.perform

        expect(deploy.reload.status).to eq("completed")
      end
    end

    context "with an already-failed deploy" do
      it "leaves it alone" do
        deploy = create(:deploy, :failed, project: project, created_at: 20.minutes.ago)

        expect(Rollbar).not_to receive(:error)

        described_class.new.perform

        expect(deploy.reload.status).to eq("failed")
      end
    end

    context "idempotency" do
      it "does not create duplicate support tickets" do
        deploy = create(:deploy, :running, project: project, created_at: 20.minutes.ago)

        expect(Rollbar).to receive(:error).with("Stuck deploy detected", anything)
          .and_return({"uuid" => "uuid-1"})

        described_class.new.perform

        expect(SupportRequest.count).to eq(1)

        # Deploy is now failed, so the stuck scope won't pick it up again.
        # But let's also verify AutoSupportTicketService guards against duplicates
        # by simulating a second call on a deploy that already has a ticket.
        deploy.reload
        expect(deploy.status).to eq("failed")
        expect(deploy.support_request).to be_present

        # Calling the service again should be a no-op
        expect {
          Deploys::AutoSupportTicketService.new(deploy).call
        }.not_to change(SupportRequest, :count)
      end
    end

    context "when support ticket creation fails" do
      it "logs error but does not raise" do
        deploy = create(:deploy, :running, project: project, created_at: 20.minutes.ago)

        expect(Rollbar).to receive(:error).with("Stuck deploy detected", anything)
          .and_return({"uuid" => "uuid-1"})
        allow(Deploys::AutoSupportTicketService).to receive_message_chain(:new, :call)
          .and_raise(StandardError, "ticket creation failed")
        expect(Rollbar).to receive(:error).with(
          "Failed to handle stuck deploy",
          hash_including(deploy_id: deploy.id)
        )

        expect { described_class.new.perform }.not_to raise_error

        # Deploy should still be marked failed even though ticket creation failed
        expect(deploy.reload.status).to eq("failed")
      end
    end
  end
end
