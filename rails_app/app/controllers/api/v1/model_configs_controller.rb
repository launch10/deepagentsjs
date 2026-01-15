class API::V1::ModelConfigsController < API::BaseController
  # This endpoint is called by Langgraph to fetch model configurations.
  # It requires internal API signature verification but not user authentication.
  skip_before_action :require_api_authentication
  before_action :verify_internal_api_request

  def index
    configs = ModelConfig.all.index_by(&:model_key).transform_values do |c|
      {
        enabled: c.enabled,
        maxUsagePercent: c.max_usage_percent,
        costIn: c.cost_in&.to_f,
        costOut: c.cost_out&.to_f,
        modelCard: c.model_card
      }
    end

    render json: {
      models: configs,
      updatedAt: ModelConfig.maximum(:updated_at)
    }
  end

  private

  def verify_internal_api_request
    signature = request.headers["X-Signature"]
    timestamp = request.headers["X-Timestamp"]

    unless signature.present? && timestamp.present?
      render json: { error: "Missing signature or timestamp" }, status: :unauthorized
      return
    end

    timestamp_int = timestamp.to_i
    if Time.at(timestamp_int) < 5.minutes.ago
      render json: { error: "Request timestamp too old" }, status: :unauthorized
      return
    end

    if Time.at(timestamp_int) > 1.minute.from_now
      render json: { error: "Request timestamp in future" }, status: :unauthorized
      return
    end

    expected_signature = generate_internal_api_signature(timestamp)

    unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
      render json: { error: "Invalid signature" }, status: :unauthorized
      return
    end

    true
  end

  def generate_internal_api_signature(timestamp)
    secret = Rails.application.credentials.devise_jwt_secret_key!
    OpenSSL::HMAC.hexdigest("SHA256", secret, timestamp.to_s)
  end
end
