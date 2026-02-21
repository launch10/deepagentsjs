class LanggraphCallbackWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 15

  # Exponential backoff: 5s, 15s, 45s, 135s, ~7m, ~20m, ~1h, ~3h, cap at 4h
  # Total coverage: ~8 hours before giving up
  sidekiq_retry_in do |count|
    (5 * (3**count)).clamp(5, 14_400) # cap at 4 hours
  end

  sidekiq_retries_exhausted do |msg, _ex|
    job_run_id = msg["args"].first
    Rails.logger.error(
      "[LanggraphCallbackWorker] Webhook delivery permanently failed " \
      "for job_run #{job_run_id} after #{msg["retry_count"]} retries"
    )
  end

  def perform(job_run_id, payload)
    job_run = JobRun.find_by(id: job_run_id)
    return unless job_run&.langgraph_callback_url.present?

    client = LanggraphCallbackClient.new(callback_url: job_run.langgraph_callback_url)
    client.deliver(payload.deep_symbolize_keys)

    Rails.logger.info("[LanggraphCallbackWorker] Delivered for job_run #{job_run_id}")
  rescue ApplicationClient::Error => e
    Rails.logger.error("[LanggraphCallbackWorker] Failed: #{e.message}")
    raise # Re-raise for Sidekiq retry
  end
end
