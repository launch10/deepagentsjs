# frozen_string_literal: true

module Leads
  class ProcessWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 5

    sidekiq_retry_in do |count|
      [1, 5, 30, 120, 300][count] || 300
    end

    def perform(account_id, website_id, email, name = nil, visit_id = nil, visitor_token = nil, gclid = nil, conversion_value = nil, conversion_currency = nil,
      utm_source = nil, utm_medium = nil, utm_campaign = nil, utm_content = nil, utm_term = nil)
      account = Account.find(account_id)
      website = Website.find(website_id)
      visit = visit_id.present? ? Ahoy::Visit.find_by(id: visit_id) : nil

      ActiveRecord::Base.transaction do
        result = Lead.find_or_create_for_signup(
          account: account,
          website: website,
          email: email,
          name: name,
          visit: visit,
          visitor_token: visitor_token,
          gclid: gclid,
          utm_source: utm_source,
          utm_medium: utm_medium,
          utm_campaign: utm_campaign,
          utm_content: utm_content,
          utm_term: utm_term
        )

        # Create conversion event in Ahoy for analytics (only for new conversions)
        if visit && !result[:already_converted]
          properties = {
            lead_id: result[:lead].id,
            email: result[:lead].email
          }

          # Include value and currency if provided
          if conversion_value.present?
            properties[:value] = conversion_value
            properties[:currency] = conversion_currency.presence || "USD"
          end

          visit.events.create!(
            name: "conversion",
            properties: properties,
            time: Time.current
          )
        end
      end
    end
  end
end
