module AI
  class GenerateEmbeddingWorker
    include Sidekiq::Worker
    sidekiq_options queue: :critical, retry: 5

    def perform(record_type, record_id)
      record = record_type.constantize.find_by(id: record_id)
      return unless record

      embedding = EmbeddingService.generate(record.content)
      return unless embedding

      record.update_column(:embedding, embedding)
    end
  end
end
