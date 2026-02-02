# frozen_string_literal: true

module Domains
  # Releases a single domain, making it available for anyone to claim again.
  #
  # Called by ReleaseStaleDomainsWorker for each stale unverified domain,
  # enabling granular retries per domain.
  #
  # When a domain is released:
  # - It's hard-deleted from the database (not soft-deleted)
  # - Associated website_urls are also deleted
  # - Atlas/Cloudflare records are removed (via destroy callbacks)
  # - The domain becomes available for anyone to claim again
  #
  # @see Domains::ReleaseStaleDomainsWorker for the batch coordinator
  class ReleaseDomainWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 3

    def perform(domain_id)
      domain = Domain.find_by(id: domain_id)

      unless domain
        Rails.logger.warn "[Domains::ReleaseDomainWorker] Domain #{domain_id} not found, may have been already released"
        return
      end

      # Re-check eligibility - DNS may have been verified since the coordinator ran
      if domain.dns_verified?
        Rails.logger.info "[Domains::ReleaseDomainWorker] Domain #{domain.domain} (id: #{domain.id}) was verified since being queued, skipping release"
        return
      end

      # Don't release platform subdomains (shouldn't happen, but defensive check)
      if domain.platform_subdomain?
        Rails.logger.warn "[Domains::ReleaseDomainWorker] Domain #{domain.domain} (id: #{domain.id}) is a platform subdomain, skipping release"
        return
      end

      Rails.logger.info "[Domains::ReleaseDomainWorker] Releasing domain: #{domain.domain} (id: #{domain.id}, created: #{domain.created_at})"
      domain.release!
    end
  end
end
