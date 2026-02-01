require "resolv"

module Domains
  class DnsVerificationService
    EXPECTED_CNAME = "cname.launch10.ai".freeze

    def initialize(domain)
      @domain = domain
    end

    def verify
      return success_result if @domain.is_platform_subdomain

      begin
        actual_cname = lookup_cname(@domain.domain)

        if cname_matches?(actual_cname)
          update_domain("verified", actual_cname, nil)
          success_result(actual_cname)
        else
          update_domain("pending", actual_cname, "CNAME not configured")
          pending_result(actual_cname, "Expected #{EXPECTED_CNAME}, got #{actual_cname || "nothing"}")
        end
      rescue Resolv::ResolvError => e
        update_domain("pending", nil, e.message)
        pending_result(nil, "DNS lookup failed: #{e.message}")
      rescue => e
        update_domain("failed", nil, e.message)
        failed_result(e.message)
      end
    end

    private

    def lookup_cname(domain)
      Resolv::DNS.open do |dns|
        # Try www subdomain first if domain doesn't start with www
        domains_to_try = [domain]
        domains_to_try.unshift("www.#{domain}") unless domain.start_with?("www.")

        domains_to_try.each do |d|
          resource = dns.getresource(d, Resolv::DNS::Resource::IN::CNAME)
          return resource.name.to_s
        rescue Resolv::ResolvError
          # Try next domain
        end

        # No CNAME found
        nil
      end
    rescue Resolv::ResolvError
      nil
    end

    def cname_matches?(actual)
      return false unless actual
      actual.downcase.chomp(".") == EXPECTED_CNAME
    end

    def update_domain(status, _actual_cname, error_message)
      @domain.update!(
        dns_verification_status: status,
        dns_last_checked_at: Time.current,
        dns_error_message: error_message
      )
    end

    def success_result(actual_cname = nil)
      {status: "verified", actual_cname: actual_cname, error: nil}
    end

    def pending_result(actual_cname, error)
      {status: "pending", actual_cname: actual_cname, error: error}
    end

    def failed_result(error)
      {status: "failed", actual_cname: nil, error: error}
    end
  end
end
