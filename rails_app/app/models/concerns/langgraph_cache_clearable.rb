module LanggraphCacheClearable
  extend ActiveSupport::Concern

  included do
    after_commit :clear_langgraph_llm_cache
  end

  private

  def clear_langgraph_llm_cache
    ClearLanggraphCacheWorker.perform_async
  rescue => e
    Rails.logger.error("[LanggraphCacheClearable] Failed to enqueue cache clear: #{e.message}")
  end
end
