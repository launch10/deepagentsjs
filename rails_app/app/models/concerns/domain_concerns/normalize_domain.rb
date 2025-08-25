module DomainConcerns
  module NormalizeDomain
    extend ActiveSupport::Concern

    def normalize_domain(domain)
      return nil if domain.blank?
      
      subdomain = extract_subdomain(domain)
      if subdomain.nil?
        "www.#{domain}"
      else
        domain
      end
    end

    def extract_subdomain(url)
      return nil if url.blank?
      
      uri = URI.parse(url.start_with?('http') ? url : "http://#{url}")
      parts = uri.host.split('.')
      return nil if parts.length <= 2
      parts.first
    end
  end
end