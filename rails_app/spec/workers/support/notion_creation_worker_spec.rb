# frozen_string_literal: true

require "rails_helper"

RSpec.describe Support::NotionCreationWorker do
  let(:support_request) { create(:support_request) }

  describe "#perform" do
    around do |example|
      original_secret = ENV["SUPPORT_NOTION_SECRET"]
      original_db_id = ENV["SUPPORT_NOTION_DATABASE_ID"]
      ENV["SUPPORT_NOTION_SECRET"] = "ntn_test_secret"
      ENV["SUPPORT_NOTION_DATABASE_ID"] = "test-database-id"
      example.run
    ensure
      ENV["SUPPORT_NOTION_SECRET"] = original_secret
      ENV["SUPPORT_NOTION_DATABASE_ID"] = original_db_id
    end

    it "sends a POST request to the Notion API" do
      stub = stub_request(:post, "https://api.notion.com/v1/pages")
        .with(
          headers: {
            "Authorization" => "Bearer ntn_test_secret",
            "Content-Type" => "application/json",
            "Notion-Version" => "2022-06-28"
          }
        )
        .to_return(status: 200, body: {id: "page-id"}.to_json)

      described_class.new.perform(support_request.id)

      expect(stub).to have_been_requested
    end

    it "marks notion_created as true on success" do
      stub_request(:post, "https://api.notion.com/v1/pages")
        .to_return(status: 200, body: {id: "page-id"}.to_json)

      described_class.new.perform(support_request.id)

      expect(support_request.reload.notion_created).to be true
    end

    it "raises an error on non-2xx response" do
      stub_request(:post, "https://api.notion.com/v1/pages")
        .to_return(status: 400, body: {message: "Invalid"}.to_json)

      expect {
        described_class.new.perform(support_request.id)
      }.to raise_error(RuntimeError, /Notion API failed/)
    end

    it "raises when support request not found" do
      expect {
        described_class.new.perform(99999)
      }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
