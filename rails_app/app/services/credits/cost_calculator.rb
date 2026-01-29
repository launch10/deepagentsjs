# frozen_string_literal: true

module Credits
  # Calculates the cost in millicredits for an LLMUsage record.
  #
  # Credit System:
  #   - 1 credit = 1 cent = $0.01
  #   - 1 millicredit = 1/1000 credit = $0.00001
  #   - $1.00 = 100 credits = 100,000 millicredits
  #
  # Formula Derivation:
  #   cost_in_dollars = tokens × price_per_million / 1,000,000
  #   cost_in_millicredits = cost_in_dollars × 100,000 (since $1 = 100,000 millicredits)
  #   Simplifying: millicredits = tokens × price_per_million / 10
  #
  # Example: 1M tokens at $1/M
  #   - Cost: $1.00 = 100 cents = 100 credits = 100,000 millicredits
  #   - Formula: 1,000,000 × 1 / 10 = 100,000 millicredits ✓
  #
  class CostCalculator
    class UnknownModelError < StandardError; end

    def initialize(llm_usage)
      @usage = llm_usage
    end

    # Calculate the total cost in millicredits for the usage record.
    #
    # @return [Integer] Cost in millicredits (rounded to nearest integer)
    # @raise [UnknownModelError] If the model is not found in ModelConfig
    #
    def call
      config = Credits::ModelNormalizer.call(@usage.model_raw)
      raise UnknownModelError, "Unknown model: #{@usage.model_raw}" unless config

      cost = 0
      cost += token_cost(@usage.input_tokens, config.cost_in)
      cost += token_cost(@usage.output_tokens, config.cost_out)
      cost += token_cost(@usage.reasoning_tokens, config.cost_reasoning || config.cost_out)
      cost += token_cost(@usage.cache_creation_tokens, config.cache_writes)
      cost += token_cost(@usage.cache_read_tokens, config.cache_reads)

      cost.round  # Round to nearest millicredit
    end

    private

    # Calculate cost for a token type.
    #
    # @param tokens [Integer, nil] Number of tokens
    # @param rate [Decimal, nil] Cost per million tokens
    # @return [Float] Cost in millicredits (not yet rounded)
    #
    def token_cost(tokens, rate)
      return 0 if tokens.to_i.zero? || rate.to_f.zero?

      # Formula: tokens × price_per_million / 10
      tokens.to_f * rate.to_f / 10.0
    end
  end
end
