require "rails_helper"

RSpec.describe Deploys::AutoSupportTicketService do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:deploy) { create(:deploy, project: project, status: "failed", stacktrace: "Build error: exit code 1") }

  before do
    # Stub out external workers to avoid side effects
    allow(SupportMailer).to receive_message_chain(:support_request, :deliver_later)
    allow(Support::SlackNotificationWorker).to receive(:perform_async)
    allow(Support::NotionCreationWorker).to receive(:perform_async)
  end

  describe "#call" do
    it "creates a SupportRequest linked to the deploy" do
      service = described_class.new(deploy)

      expect { service.call }.to change(SupportRequest, :count).by(1)

      deploy.reload
      expect(deploy.support_request).to be_present
      expect(deploy.support_request.ticket_id).to be_present
    end

    it "uses the account owner as the user" do
      service = described_class.new(deploy)
      result = service.call

      expect(result.user).to eq(account.owner)
      expect(result.account).to eq(account)
    end

    it "sets category to 'Report a bug'" do
      result = described_class.new(deploy).call
      expect(result.category).to eq("Report a bug")
    end

    it "includes deploy ID and project info in description" do
      result = described_class.new(deploy).call

      expect(result.description).to include("deploy ##{deploy.id}")
      expect(result.description).to include(project.name)
      expect(result.description).to include(project.uuid)
    end

    it "includes stacktrace in description when present" do
      result = described_class.new(deploy).call
      expect(result.description).to include("Build error: exit code 1")
    end

    it "skips if support_request already exists (no duplicates)" do
      described_class.new(deploy).call

      expect { described_class.new(deploy.reload).call }.not_to change(SupportRequest, :count)
    end

    it "fires email, Slack, and Notion workers via SupportRequest callbacks" do
      described_class.new(deploy).call

      expect(SupportMailer).to have_received(:support_request)
      expect(Support::SlackNotificationWorker).to have_received(:perform_async)
      expect(Support::NotionCreationWorker).to have_received(:perform_async)
    end

    it "returns the ticket reference in SR-XXXXXXXX format" do
      result = described_class.new(deploy).call
      expect(result.ticket_reference).to match(/\ASR-[A-Z0-9]{8}\z/)
    end
  end
end
