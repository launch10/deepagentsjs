# frozen_string_literal: true

module Domains
  # Verifies DNS configuration for a single custom domain.
  #
  # Called by DnsVerificationBatchWorker for each domain needing verification,
  # enabling granular retries per domain.
  #
  # The worker:
  # - Re-checks eligibility (domain may have been verified/deleted since being queued)
  # - Delegates to DnsVerificationService for the actual DNS lookup
  # - Updates the domain's dns_verification_status based on result
  #
  # Platform subdomains are skipped (they don't need DNS verification).
  #
  # @see Domains::DnsVerificationBatchWorker for the batch coordinator
  # @see Domains::DnsVerificationService for the verification logic
  class VerifyDomainDnsWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    def perform(domain_id)
      domain = Domain.find_by(id: domain_id)

      unless domain
        Rails.logger.warn "[Domains::VerifyDomainDnsWorker] Domain #{domain_id} not found, may have been deleted"
        return
      end

      # Skip platform subdomains (shouldn't happen, but defensive check)
      if domain.platform_subdomain?
        Rails.logger.debug "[Domains::VerifyDomainDnsWorker] Domain #{domain.domain} is a platform subdomain, skipping"
        return
      end

      # Skip already verified domains (may have been verified since being queued)
      if domain.dns_verified?
        Rails.logger.debug "[Domains::VerifyDomainDnsWorker] Domain #{domain.domain} already verified, skipping"
        return
      end

      result = Domains::DnsVerificationService.new(domain).verify

      log_verification_result(domain, result)
    end

    private

    def log_verification_result(domain, result)
      case result[:status]
      when "verified"
        Rails.logger.info "[Domains::VerifyDomainDnsWorker] Domain #{domain.domain} (id: #{domain.id}) DNS verified successfully"
      when "pending"
        Rails.logger.info "[Domains::VerifyDomainDnsWorker] Domain #{domain.domain} (id: #{domain.id}) DNS pending: #{result[:error]}"
      when "failed"
        Rails.logger.warn "[Domains::VerifyDomainDnsWorker] Domain #{domain.domain} (id: #{domain.id}) DNS verification failed: #{result[:error]}"
      end
    end
  end
end
