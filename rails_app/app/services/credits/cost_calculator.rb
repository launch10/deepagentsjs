# frozen_string_literal: true

module Credits
  # Calculates the cost in millicredits for an LLMUsage record.
  #
  # Formula: millicredits = tokens × price_per_million / 10
  #
  # Where:
  # - 1 millicredit = 0.001 credits = 0.001 cents = $0.00001
  # - 1 credit = 1000 millicredits = 1 cent of our LLM cost
  #
  # Example verification:
  #   100 Haiku input tokens at $1/M:
  #   - Actual cost: 100 × $1/1,000,000 = $0.0001 = 0.01 cents
  #   - Formula: 100 × 1 / 10 = 10 millicredits
  #   - 10 millicredits = 10/1000 credits = 0.01 credits = 0.01 cents ✓
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
      config = ModelNormalizer.call(@usage.model_raw)
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
