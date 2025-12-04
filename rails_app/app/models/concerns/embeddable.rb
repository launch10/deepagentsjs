module Embeddable
  extend ActiveSupport::Concern

  included do
    has_neighbors :embedding

    after_save :enqueue_embedding_generation, if: :should_generate_embedding?
  end

  def nearest_files(count: 5)
    return self.class.none unless embedding.present?

    nearest_neighbors(:embedding, distance: "cosine").first(count)
  end

  private

  def should_generate_embedding?
    saved_change_to_content? && content.present?
  end

  def enqueue_embedding_generation
    if Rails.env.production?
      AI::GenerateEmbeddingWorker.perform_async(self.class.name, id)
    else
      AI::GenerateEmbeddingWorker.new.perform(self.class.name, id)
    end
  end
end
