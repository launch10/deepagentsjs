module DomainConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_api_json
      {
        id: id,
        domain: domain,
        account_id: account_id,
        website_id: website_id,
        is_platform_subdomain: is_platform_subdomain,
        cloudflare_zone_id: cloudflare_zone_id,
        created_at: created_at.iso8601,
        updated_at: updated_at.iso8601
      }
    end
  end
end
