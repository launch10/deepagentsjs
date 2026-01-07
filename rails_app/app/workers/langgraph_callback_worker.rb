class LanggraphCallbackWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  sidekiq_retry_in do |count|
    [5, 30, 120][count] || 120
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
