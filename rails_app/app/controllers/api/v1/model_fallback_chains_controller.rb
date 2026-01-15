class API::V1::ModelFallbackChainsController < API::BaseController
  # This endpoint is called by Langgraph to fetch fallback chain configurations.
  # It requires internal API signature verification but not user authentication.
  skip_before_action :require_api_authentication
  before_action :verify_internal_api_request

  def index
    render json: {
      chains: ModelFallbackChain.all_chains,
      updatedAt: ModelFallbackChain.maximum(:updated_at)
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
