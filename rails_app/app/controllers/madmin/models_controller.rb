module Madmin
  class ModelsController < Madmin::ApplicationController
    def index
      @model_configs = ModelConfig.order(:model_key)
      @model_preferences = ModelPreference.order(:cost_tier, :speed_tier, :skill)

      render inertia: "Madmin/Models/Index",
        props: {
          modelConfigs: @model_configs.map { |c| serialize_config(c) },
          modelPreferences: @model_preferences.map { |p| serialize_preference(p) }
        }
    end

    def update_config
      config = ModelConfig.find(params[:id])
      if config.update(config_params)
        render json: serialize_config(config)
      else
        render json: {errors: config.errors.full_messages}, status: :unprocessable_entity
      end
    end

    def update_preference
      preference = ModelPreference.find(params[:id])
      if preference.update(preference_params)
        render json: serialize_preference(preference)
      else
        render json: {errors: preference.errors.full_messages}, status: :unprocessable_entity
      end
    end

    private

    def config_params
      params.require(:model_config).permit(:enabled, :max_usage_percent, :cost_in, :cost_out, :model_card)
    end

    def preference_params
      params.require(:model_preference).permit(model_keys: [])
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

    def serialize_preference(preference)
      {
        id: preference.id,
        costTier: preference.cost_tier,
        speedTier: preference.speed_tier,
        skill: preference.skill,
        modelKeys: preference.model_keys,
        updatedAt: preference.updated_at&.iso8601
      }
    end
  end
end
