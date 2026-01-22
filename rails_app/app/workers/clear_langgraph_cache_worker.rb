class ClearLanggraphCacheWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  def perform
    LanggraphCacheClient.new.clear_llm_cache
    Rails.logger.info("[ClearLanggraphCacheWorker] LLM cache cleared")
  rescue ApplicationClient::Error => e
    Rails.logger.error("[ClearLanggraphCacheWorker] Failed: #{e.message}")
    raise
  end
end
