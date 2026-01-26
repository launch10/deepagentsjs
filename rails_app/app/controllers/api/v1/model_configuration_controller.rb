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
        max_usage_percent: c.max_usage_percent,
        cost_in: c.cost_in&.to_f,
        cost_out: c.cost_out&.to_f,
        cost_reasoning: c.cost_reasoning&.to_f,
        cache_reads: c.cache_reads&.to_f,
        cache_writes: c.cache_writes&.to_f,
        model_card: c.model_card,
        provider: c.provider,
        price_tier: c.price_tier
      }
    end

    render json: {
      models: configs,
      preferences: ModelPreference.all_preferences,
      updated_at: [
        ModelConfig.maximum(:updated_at),
        ModelPreference.maximum(:updated_at)
      ].compact.max
    }
  end
end
