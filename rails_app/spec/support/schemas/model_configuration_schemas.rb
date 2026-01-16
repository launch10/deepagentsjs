# frozen_string_literal: true

module APISchemas
  module ModelConfiguration
    # Individual model config object
    def self.model_config_object
      {
        type: :object,
        properties: {
          enabled: {type: :boolean, description: "Whether this model is enabled"},
          maxUsagePercent: {type: :integer, description: "Maximum usage percentage for this model"},
          costIn: {type: :number, nullable: true, description: "Cost per input token"},
          costOut: {type: :number, nullable: true, description: "Cost per output token"},
          modelCard: {type: :string, nullable: true, description: "Model card identifier"}
        },
        required: %w[enabled maxUsagePercent]
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
          updatedAt: {
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
