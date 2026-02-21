# frozen_string_literal: true

require "rails_helper"

RSpec.describe Support::SlackNotificationWorker do
  let(:support_request) { create(:support_request) }

  describe "#perform" do
    around do |example|
      original = ENV["SUPPORT_SLACK_WEBHOOK_URL"]
      ENV["SUPPORT_SLACK_WEBHOOK_URL"] = "https://hooks.slack.com/services/test/test/test"
      example.run
    ensure
      ENV["SUPPORT_SLACK_WEBHOOK_URL"] = original
    end

    it "sends a POST request to the Slack webhook" do
      stub = stub_request(:post, ENV["SUPPORT_SLACK_WEBHOOK_URL"])
        .with(
          headers: {"Content-Type" => "application/json"},
          body: hash_including("text" => /SR-/)
        )
        .to_return(status: 200, body: "ok")

      described_class.new.perform(support_request.id)

      expect(stub).to have_been_requested
    end

    it "marks slack_notified as true on success" do
      stub_request(:post, ENV["SUPPORT_SLACK_WEBHOOK_URL"])
        .to_return(status: 200, body: "ok")

      described_class.new.perform(support_request.id)

      expect(support_request.reload.slack_notified).to be true
    end

    it "raises an error on non-200 response" do
      stub_request(:post, ENV["SUPPORT_SLACK_WEBHOOK_URL"])
        .to_return(status: 500, body: "error")

      expect {
        described_class.new.perform(support_request.id)
      }.to raise_error(RuntimeError, /Slack webhook failed/)
    end

    it "raises when support request not found" do
      expect {
        described_class.new.perform(99999)
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    context "when SUPPORT_SLACK_WEBHOOK_URL is not set" do
      around do |example|
        original = ENV["SUPPORT_SLACK_WEBHOOK_URL"]
        ENV.delete("SUPPORT_SLACK_WEBHOOK_URL")
        example.run
      ensure
        ENV["SUPPORT_SLACK_WEBHOOK_URL"] = original
      end

      it "raises in production" do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))

        expect {
          described_class.new.perform(support_request.id)
        }.to raise_error(RuntimeError, /SUPPORT_SLACK_WEBHOOK_URL is not set/)
      end

      it "silently returns in development" do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development"))

        expect {
          described_class.new.perform(support_request.id)
        }.not_to raise_error
      end
    end
  end
end
