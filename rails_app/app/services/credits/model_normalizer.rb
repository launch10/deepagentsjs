# frozen_string_literal: true

module Credits
  # Maps raw model names (e.g., "claude-haiku-4-5-20251001") to their ModelConfig
  # using longest-prefix matching on the model_card field.
  #
  # This is necessary because LLM providers often include version suffixes or
  # date stamps in model names that aren't in our config database.
  #
  # Example:
  #   model_raw: "claude-haiku-4-5-20251001"
  #   model_card: "claude-haiku-4-5"
  #   -> matches because model_raw starts with model_card
  #
  class ModelNormalizer
    class << self
      # Find the ModelConfig that best matches the given raw model name.
      #
      # @param model_raw [String] The raw model name from LLM usage
      # @return [ModelConfig, nil] The matching config, or nil if no match
      #
      def call(model_raw)
        return nil if model_raw.blank?

        # Try exact match first (most performant)
        config = ModelConfig.find_by(model_card: model_raw)
        return config if config

        # Longest-prefix matching
        # Find all configs where model_raw starts with model_card
        matching_configs = ModelConfig.where.not(model_card: nil).select do |config|
          config.model_card.present? && model_raw.start_with?(config.model_card)
        end

        # Return the one with the longest model_card (most specific match)
        matching_configs.max_by { |c| c.model_card.length }
      end
    end
  end
end
