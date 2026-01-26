class API::V1::ModelConfigurationController < API::BaseController
  # This endpoint is called by Langgraph to fetch all model configuration.
  # It requires internal service call signature verification but not user authentication.
  skip_before_action :require_api_authentication
  before_action :verify_internal_service_call

  # GET /api/v1/model_configuration
  # Returns both model configs and model preferences in a single response
  def index
    configs = ModelConfig.all.index_by(&:model_key).transform_values do |c|
      {
        enabled: c.enabled,
        maxUsagePercent: c.max_usage_percent,
        costIn: c.cost_in&.to_f,
        costOut: c.cost_out&.to_f,
        costReasoning: c.cost_reasoning&.to_f,
        cacheReads: c.cache_reads&.to_f,
        cacheWrites: c.cache_writes&.to_f,
        modelCard: c.model_card,
        priceTier: c.price_tier
      }
    end

    render json: {
      models: configs,
      preferences: ModelPreference.all_preferences,
      updatedAt: [
        ModelConfig.maximum(:updated_at),
        ModelPreference.maximum(:updated_at)
      ].compact.max
    }
  end
end
