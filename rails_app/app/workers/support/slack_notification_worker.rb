require "net/http"

module Support
  class SlackNotificationWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    def perform(support_request_id)
      support_request = SupportRequest.find(support_request_id)
      webhook_url = ENV["SUPPORT_SLACK_WEBHOOK_URL"] || Rails.application.credentials.dig(:support, :slack_webhook_url)

      if webhook_url.blank?
        raise "SUPPORT_SLACK_WEBHOOK_URL is not set" if Rails.env.production?
        return # if not production, skip
      end

      payload = {
        text: "New Support Request: #{support_request.ticket_reference}",
        blocks: [
          {
            type: "header",
            text: {type: "plain_text", text: "#{support_request.category}: #{support_request.subject}".truncate(150)}
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*From:* #{support_request.user.email}\n*Tier:* #{support_request.subscription_tier || "None"}\n*Credits:* #{support_request.credits_remaining || "N/A"}"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: support_request.description.truncate(500)
            }
          }
        ]
      }

      uri = URI(webhook_url)
      response = Net::HTTP.post(uri, payload.to_json, "Content-Type" => "application/json")

      if response.code.to_i == 200
        support_request.update!(slack_notified: true)
      else
        raise "Slack webhook failed: #{response.code} #{response.body}"
      end
    end
  end
end
