module DomainConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_api_json(include_website_urls: false)
      result = {
        id: id,
        domain: domain,
        account_id: account_id,
        is_platform_subdomain: is_platform_subdomain,
        cloudflare_zone_id: cloudflare_zone_id,
        dns_verification_status: dns_verification_status,
        dns_last_checked_at: dns_last_checked_at&.iso8601,
        dns_error_message: dns_error_message,
        created_at: created_at.iso8601,
        updated_at: updated_at.iso8601
      }

      if include_website_urls
        result[:website_urls] = website_urls.map do |url|
          {
            id: url.id,
            path: url.path,
            website_id: url.website_id
          }
        end
      end

      result
    end
  end
end
