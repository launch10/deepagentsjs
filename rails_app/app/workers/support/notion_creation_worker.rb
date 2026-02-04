require "net/http"

module Support
  class NotionCreationWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    # Notion database property names — must match the Notion database schema exactly
    PROP_REFERENCE = "Reference"
    PROP_SUBJECT = "Subject"
    PROP_DESCRIPTION = "Description"
    PROP_CATEGORY = "Category"
    PROP_EMAIL = "Email"
    PROP_STATUS = "Status"
    PROP_SUBSCRIPTION = "Subscription"
    PROP_CREDITS = "Credits"
    PROP_SUBMITTED = "Submitted"
    PROP_SOURCE_URL = "Source URL"
    PROP_USER_ID = "User ID"
    PROP_ATTACHMENTS = "Attachments"

    STATUS_OPEN = "Open"

    # Map form categories to Notion select values
    CATEGORY_MAP = {
      "Report a bug" => "Bug",
      "Billing question" => "Billing",
      "How do I...?" => "How-to",
      "Feature request" => "Feature Request",
      "Other" => "Other"
    }.freeze

    def perform(support_request_id)
      support_request = SupportRequest.find(support_request_id)
      notion_secret = ENV.fetch("SUPPORT_NOTION_SECRET")
      database_id = ENV.fetch("SUPPORT_NOTION_DATABASE_ID")

      uri = URI("https://api.notion.com/v1/pages")
      request = Net::HTTP::Post.new(uri)
      request["Authorization"] = "Bearer #{notion_secret}"
      request["Content-Type"] = "application/json"
      request["Notion-Version"] = "2022-06-28"

      tier = support_request.subscription_tier || "None"
      notion_category = CATEGORY_MAP.fetch(support_request.category, "Other")

      properties = {
        PROP_REFERENCE => {title: [{text: {content: support_request.ticket_reference}}]},
        PROP_SUBJECT => {rich_text: [{text: {content: support_request.subject}}]},
        PROP_DESCRIPTION => {rich_text: [{text: {content: support_request.description.truncate(2000)}}]},
        PROP_CATEGORY => {select: {name: notion_category}},
        PROP_EMAIL => {email: support_request.user.email},
        PROP_STATUS => {select: {name: STATUS_OPEN}},
        PROP_SUBSCRIPTION => {select: {name: tier}},
        PROP_CREDITS => {number: support_request.credits_remaining || 0},
        PROP_SUBMITTED => {date: {start: support_request.created_at.iso8601}},
        PROP_USER_ID => {rich_text: [{text: {content: support_request.user.id.to_s}}]}
      }

      if support_request.submitted_from_url.present?
        properties[PROP_SOURCE_URL] = {url: support_request.submitted_from_url}
      end

      if support_request.attachments.attached?
        host = ENV.fetch("APP_URL", "http://localhost:3000")
        files = support_request.attachments.map do |attachment|
          {
            name: attachment.filename.to_s,
            type: "external",
            external: {url: Rails.application.routes.url_helpers.rails_blob_url(attachment, host: host)}
          }
        end
        properties[PROP_ATTACHMENTS] = {files: files}
      end

      request.body = {
        parent: {database_id: database_id},
        properties: properties
      }.to_json

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(request) }

      if response.code.to_i.between?(200, 299)
        support_request.update!(notion_created: true)
      else
        raise "Notion API failed: #{response.code} #{response.body}"
      end
    end
  end
end
