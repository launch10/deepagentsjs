module InternalAPIVerification
  extend ActiveSupport::Concern

  def internal_api_request?
    # internal_api sends JWT via Authorization header, not cookies
    # Frontend sends JWT via cookies
    request.headers['Authorization'].present? &&
    request.headers['X-Signature'].present? &&
    request.headers['X-Timestamp'].present?
  end

  private

  def verify_internal_api_signature
    signature = request.headers['X-Signature']
    timestamp = request.headers['X-Timestamp']

    unless signature.present? && timestamp.present?
      render json: {error: 'Missing signature or timestamp'}, status: :unauthorized
      return
    end

    timestamp_int = timestamp.to_i
    if Time.at(timestamp_int) < 5.minutes.ago
      render json: {error: 'Request timestamp too old'}, status: :unauthorized
      return
    end

    if Time.at(timestamp_int) > 1.minute.from_now
      render json: {error: 'Request timestamp in future'}, status: :unauthorized
      return
    end

    expected_signature = generate_internal_api_signature(timestamp)

    unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
      render json: {error: 'Invalid signature'}, status: :unauthorized
      return
    end

    true
  end

  def generate_internal_api_signature(timestamp)
    secret = Rails.application.credentials.devise_jwt_secret_key!
    OpenSSL::HMAC.hexdigest('SHA256', secret, timestamp.to_s)
  end
end
