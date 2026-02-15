# frozen_string_literal: true

module Leads
  class ProcessWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 5

    sidekiq_retry_in do |count|
      [1, 5, 30, 120, 300][count] || 300
    end

    # Options hash keys:
    #   email (required), name, visit_id, visitor_token, gclid,
    #   conversion_value, conversion_currency,
    #   utm_source, utm_medium, utm_campaign, utm_content, utm_term
    def perform(account_id, website_id, options = {})
      options = options.symbolize_keys
      account = Account.find(account_id)
      website = Website.find(website_id)
      visit = options[:visit_id].present? ? Ahoy::Visit.find_by(id: options[:visit_id]) : nil

      result = nil

      ActiveRecord::Base.transaction do
        result = Lead.find_or_create_for_signup(
          account: account,
          website: website,
          email: options[:email],
          name: options[:name],
          visit: visit,
          visitor_token: options[:visitor_token],
          gclid: options[:gclid],
          utm_source: options[:utm_source],
          utm_medium: options[:utm_medium],
          utm_campaign: options[:utm_campaign],
          utm_content: options[:utm_content],
          utm_term: options[:utm_term]
        )

        # Create conversion event in Ahoy for analytics (only for new conversions)
        if visit && !result[:already_converted]
          properties = {
            lead_id: result[:lead].id,
            email: result[:lead].email
          }

          # Include value and currency if provided
          if options[:conversion_value].present?
            properties[:value] = options[:conversion_value]
            properties[:currency] = options[:conversion_currency].presence || "USD"
          end

          visit.events.create!(
            name: "conversion",
            properties: properties,
            time: Time.current
          )
        end
      end

      # Track after successful transaction for new leads
      if result&.dig(:created)
        TrackEvent.call("lead_received",
          user: account.owner,
          account: account,
          project: website.project,
          website: website,
          project_uuid: website.project&.uuid,
          has_gclid: options[:gclid].present?,
          total_leads_for_project: website.leads.count)
      end
    end
  end
end
