# frozen_string_literal: true

module Domains
  # Batch coordinator for background DNS verification of custom domains.
  #
  # Finds custom domains that need DNS verification and enqueues individual
  # VerifyDomainDnsWorker jobs for each one. This enables:
  # - Granular retries per domain (if one fails, others aren't affected)
  # - Better parallelism via Sidekiq concurrency
  # - Reduced impact of DNS lookup timeouts
  #
  # Scoping criteria to limit batch size:
  # - Custom domains only (not platform subdomains)
  # - Not yet verified (dns_verification_status != 'verified')
  # - Created within the grace period (7 days) - older domains get released
  # - Not checked within the last hour (avoids redundant checks)
  #
  # Scheduled to run hourly via Zhong.
  #
  # @see Domains::VerifyDomainDnsWorker for the individual verification logic
  # @see Domains::ReleaseStaleDomainsWorker for releasing domains that fail verification
  class DnsVerificationBatchWorker < ApplicationWorker
    sidekiq_options queue: :default

    # How often to re-check domains (avoid checking same domain repeatedly)
    CHECK_INTERVAL = 1.hour

    # Don't verify domains older than this (they'll be released instead)
    GRACE_PERIOD_DAYS = 7

    def perform
      domains_needing_verification.find_each do |domain|
        Domains::VerifyDomainDnsWorker.perform_async(domain.id)
      end
    end

    private

    def domains_needing_verification
      Domain
        .where(is_platform_subdomain: false)
        .where("dns_verification_status IS NULL OR dns_verification_status != ?", "verified")
        .where("created_at >= ?", GRACE_PERIOD_DAYS.days.ago)
        .where(needs_check_condition)
    end

    # Domains that either:
    # - Have never been checked (dns_last_checked_at is NULL)
    # - Were last checked more than CHECK_INTERVAL ago
    def needs_check_condition
      Domain.arel_table[:dns_last_checked_at].eq(nil).or(
        Domain.arel_table[:dns_last_checked_at].lt(CHECK_INTERVAL.ago)
      )
    end
  end
end
