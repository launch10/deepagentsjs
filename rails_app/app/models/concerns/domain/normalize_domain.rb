class Domain
  module NormalizeDomain
    extend ActiveSupport::Concern

    def normalize_domain(domain)
      subdomain = extract_subdomain(domain)
      if subdomain.nil?
        "www.#{domain}"
      else
        domain
      end
    end

    def extract_subdomain(url)
      uri = URI.parse(url.start_with?('http') ? url : "http://#{url}")
      parts = uri.host.split('.')
      return nil if parts.length <= 2
      parts.first
    end
  end
end