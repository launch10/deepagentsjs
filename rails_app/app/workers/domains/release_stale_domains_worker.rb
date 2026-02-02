# frozen_string_literal: true

module Domains
  # Batch coordinator for releasing stale unverified custom domains.
  #
  # Finds custom domains that have failed DNS verification for more than 7 days
  # and enqueues individual ReleaseDomainWorker jobs for each one.
  #
  # This prevents malicious users from squatting on domains they don't own.
  # Platform subdomains (*.launch10.site) are NOT affected - they are always
  # considered verified and don't require DNS verification.
  #
  # Scheduled to run daily via Zhong.
  #
  # @see Domains::ReleaseDomainWorker for the individual domain release logic
  class ReleaseStaleDomainsWorker < ApplicationWorker
    sidekiq_options queue: :default

    GRACE_PERIOD_DAYS = 7

    def perform
      Domain.stale_unverified(grace_period_days: GRACE_PERIOD_DAYS).find_each do |domain|
        Domains::ReleaseDomainWorker.perform_async(domain.id)
      end
    end
  end
end
