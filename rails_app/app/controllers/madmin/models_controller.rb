module Madmin
  class ModelsController < Madmin::ApplicationController
    def index
      @model_configs = ModelConfig.order(:model_key)
      @model_preferences = ModelPreference.order(:cost_tier, :speed_tier, :skill)

      render inertia: "Madmin/Models",
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

    def create_config
      config = ModelConfig.new(create_config_params)
      if config.save
        render json: serialize_config(config), status: :created
      else
        render json: {errors: config.errors.full_messages}, status: :unprocessable_entity
      end
    end

    def destroy_config
      config = ModelConfig.find(params[:id])
      config.destroy!
      head :no_content
    rescue ActiveRecord::RecordNotDestroyed => e
      render json: {errors: [e.message]}, status: :unprocessable_entity
    end

    private

    def config_params
      params.require(:model_config).permit(:enabled, :max_usage_percent, :cost_in, :cost_out, :model_card)
    end

    def create_config_params
      params.require(:model_config).permit(:model_key, :model_card, :enabled, :max_usage_percent, :cost_in, :cost_out)
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
