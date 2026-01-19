module InternalAPIVerification
  extend ActiveSupport::Concern

  # Check if this is an internal API request (Langgraph -> Rails with user context)
  # These requests have both JWT auth AND signature verification
  def internal_api_request?
    request.headers["Authorization"].present? &&
      request.headers["X-Signature"].present? &&
      request.headers["X-Timestamp"].present?
  end

  # Check if this is an internal service call (Langgraph -> Rails without user context)
  # These requests have signature verification only, no JWT
  def internal_service_call?
    request.headers["Authorization"].blank? &&
      request.headers["X-Signature"].present? &&
      request.headers["X-Timestamp"].present?
  end

  private

  # Verify signature for internal API requests (with JWT)
  def verify_internal_api_signature
    verify_signature
  end

  # Verify signature for internal service calls (without JWT)
  # Use this as a before_action for endpoints that don't need user auth
  # Rejects requests that include an Authorization header (those should use user-auth endpoints)
  def verify_internal_service_call
    if request.headers["Authorization"].present?
      render json: {error: "Internal service calls must not include Authorization header"}, status: :unauthorized
      return
    end

    verify_signature
  end

  # Shared signature verification logic
  def verify_signature
    signature = request.headers["X-Signature"]
    timestamp = request.headers["X-Timestamp"]

    unless signature.present? && timestamp.present?
      render json: {error: "Missing signature or timestamp"}, status: :unauthorized
      return
    end

    timestamp_int = timestamp.to_i
    if Time.at(timestamp_int) < 5.minutes.ago
      render json: {error: "Request timestamp too old"}, status: :unauthorized
      return
    end

    if Time.at(timestamp_int) > 1.minute.from_now
      render json: {error: "Request timestamp in future"}, status: :unauthorized
      return
    end

    expected_signature = generate_internal_api_signature(timestamp)

    unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
      render json: {error: "Invalid signature"}, status: :unauthorized
      return
    end

    true
  end

  def generate_internal_api_signature(timestamp)
    secret = Rails.application.credentials.devise_jwt_secret_key!
    OpenSSL::HMAC.hexdigest("SHA256", secret, timestamp.to_s)
  end
end
