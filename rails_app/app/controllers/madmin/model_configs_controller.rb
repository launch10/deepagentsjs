module Madmin
  class ModelConfigsController < Madmin::ApplicationController
    def index
      @model_configs = ModelConfig.order(:model_key)
      render inertia: "Madmin/ModelConfigs/Index", props: {
        modelConfigs: @model_configs.map { |c| serialize_config(c) }
      }
    end

    def update
      config = ModelConfig.find(params[:id])
      if config.update(config_params)
        render json: serialize_config(config)
      else
        render json: { errors: config.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def config_params
      params.require(:model_config).permit(:enabled, :max_usage_percent, :cost_in, :cost_out, :model_card)
    end

    def serialize_config(config)
      {
        id: config.id,
        modelKey: config.model_key,
        modelCard: config.model_card,
        enabled: config.enabled,
        maxUsagePercent: config.max_usage_percent,
        costIn: config.cost_in&.to_f,
        costOut: config.cost_out&.to_f,
        updatedAt: config.updated_at&.iso8601
      }
    end
  end
end
