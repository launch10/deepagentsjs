require "net/http"

module Support
  class NotionCreationWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    # Notion database property names — must match the Notion database schema exactly
    PROP_TITLE = "Title"
    PROP_CATEGORY = "Category"
    PROP_EMAIL = "Email"
    PROP_TICKET_REF = "Ticket Ref"
    PROP_STATUS = "Status"
    PROP_TIER = "Tier"
    STATUS_NEW = "New"

    def perform(support_request_id)
      support_request = SupportRequest.find(support_request_id)
      notion_secret = ENV.fetch("SUPPORT_NOTION_SECRET")
      database_id = ENV.fetch("SUPPORT_NOTION_DATABASE_ID")

      uri = URI("https://api.notion.com/v1/pages")
      request = Net::HTTP::Post.new(uri)
      request["Authorization"] = "Bearer #{notion_secret}"
      request["Content-Type"] = "application/json"
      request["Notion-Version"] = "2022-06-28"

      request.body = {
        parent: {database_id: database_id},
        properties: {
          PROP_TITLE => {title: [{text: {content: support_request.subject}}]},
          PROP_CATEGORY => {select: {name: support_request.category}},
          PROP_EMAIL => {email: support_request.user.email},
          PROP_TICKET_REF => {rich_text: [{text: {content: support_request.ticket_reference}}]},
          PROP_STATUS => {select: {name: STATUS_NEW}},
          PROP_TIER => {rich_text: [{text: {content: support_request.subscription_tier || "N/A"}}]}
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{type: "text", text: {content: support_request.description.truncate(2000)}}]
            }
          }
        ]
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
