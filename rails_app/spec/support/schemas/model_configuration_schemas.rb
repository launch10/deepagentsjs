# frozen_string_literal: true

module APISchemas
  module ModelConfiguration
    # Individual model config object
    def self.model_config_object
      {
        type: :object,
        properties: {
          enabled: {type: :boolean, description: "Whether this model is enabled"},
          max_usage_percent: {type: :integer, nullable: true, description: "Maximum usage percentage for this model"},
          cost_in: {type: :number, nullable: true, description: "Cost per million input tokens in dollars"},
          cost_out: {type: :number, nullable: true, description: "Cost per million output tokens in dollars"},
          cost_reasoning: {type: :number, nullable: true, description: "Cost per million reasoning tokens in dollars"},
          cache_reads: {type: :number, nullable: true, description: "Cost per million cache read tokens in dollars"},
          cache_writes: {type: :number, nullable: true, description: "Cost per million cache write tokens in dollars"},
          model_card: {type: :string, nullable: true, description: "Model card identifier (e.g., claude-sonnet-4-5-20250220)"},
          provider: {type: :string, nullable: true, description: "LLM provider (anthropic, openai, groq, ollama)"},
          price_tier: {type: :integer, description: "Price tier (1=premium, 5=cheap) based on weighted effective cost"}
        },
        required: %w[enabled price_tier]
      }
    end

    # Full response schema
    def self.response
      {
        type: :object,
        properties: {
          models: {
            type: :object,
            description: "Map of model_key to model configuration",
            additionalProperties: model_config_object
          },
          preferences: {
            type: :object,
            description: "Nested map of cost_tier -> speed_tier -> skill -> model_keys array",
            additionalProperties: {
              type: :object,
              additionalProperties: {
                type: :object,
                additionalProperties: {
                  type: :array,
                  items: {type: :string}
                }
              }
            }
          },
          updated_at: {
            type: :string,
            format: "date-time",
            nullable: true,
            description: "Most recent update timestamp across all configs"
          }
        },
        required: %w[models preferences]
      }
    end

    # Error response schema
    def self.error_response
      {
        type: :object,
        properties: {
          error: {type: :string, description: "Error message"}
        },
        required: %w[error]
      }
    end
  end
end
