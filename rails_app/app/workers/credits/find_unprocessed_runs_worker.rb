# frozen_string_literal: true

module Credits
  # Background polling job to find and process stale LLM usage records.
  #
  # This worker acts as a backup to the webhook-triggered ChargeRunWorker.
  # It runs periodically (via Zhong) to catch any usage records that weren't
  # processed due to webhook failures or race conditions.
  #
  # Only processes records older than STALENESS_THRESHOLD to avoid
  # interfering with normal webhook-triggered processing.
  #
  class FindUnprocessedRunsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    STALENESS_THRESHOLD = 2.minutes

    def perform
      stale_runs = LLMUsage.unprocessed
        .where("created_at < ?", STALENESS_THRESHOLD.ago)
        .distinct
        .pluck(:run_id)

      stale_runs.each { |run_id| ChargeRunWorker.perform_async(run_id) }
    end
  end
end
