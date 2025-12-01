class EmbeddingService
  MODEL = "text-embedding-3-small".freeze

  class << self
    def generate(text)
      return nil if text.blank?

      result = RubyLLM.embed(truncate_text(text), model: MODEL)
      vectors = result.vectors
      (vectors.is_a?(Array) && vectors.first.is_a?(Array)) ? vectors.first : vectors
    rescue => e
      Rails.logger.error("EmbeddingService error: #{e.message}")
      nil
    end

    def generate_batch(texts)
      return [] if texts.blank?

      result = RubyLLM.embed(texts.map { |t| truncate_text(t) }, model: MODEL)
      result.vectors
    rescue => e
      Rails.logger.error("EmbeddingService batch error: #{e.message}")
      []
    end

    private

    def truncate_text(text, max_tokens: 8000)
      text.to_s.truncate(max_tokens * 4)
    end
  end
end
