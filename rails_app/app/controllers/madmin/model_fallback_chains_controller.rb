module Madmin
  class ModelFallbackChainsController < Madmin::ApplicationController
    def index
      @chains = ModelFallbackChain.order(:cost_tier, :speed_tier, :skill)
      @model_keys = ModelConfig.pluck(:model_key).sort

      render inertia: "Madmin/ModelFallbackChains/Index", props: {
        chains: @chains.map { |c| serialize_chain(c) },
        availableModels: @model_keys
      }
    end

    def update
      chain = ModelFallbackChain.find(params[:id])
      if chain.update(chain_params)
        render json: serialize_chain(chain)
      else
        render json: { errors: chain.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def chain_params
      params.require(:model_fallback_chain).permit(model_keys: [])
    end

    def serialize_chain(chain)
      {
        id: chain.id,
        costTier: chain.cost_tier,
        speedTier: chain.speed_tier,
        skill: chain.skill,
        modelKeys: chain.model_keys,
        updatedAt: chain.updated_at&.iso8601
      }
    end
  end
end
