# Helper methods for JWT authentication in request specs
module JwtHelpers
  def jwt_secret
    Rails.application.credentials.devise_jwt_secret_key
  end

  def switch_account_to(account)
    @current_test_account = account
  end

  def generate_jwt_for(user, account: nil, expires_in: 24.hours)
    account ||= @current_test_account || user.owned_account

    payload = {
      jti: SecureRandom.uuid,
      sub: user.id,
      account_id: account&.id,
      exp: expires_in.from_now.to_i,
      iat: Time.current.to_i
    }
    JWT.encode(payload, jwt_secret, 'HS256')
  end

  def auth_headers_for(user, account: nil, expires_in: 24.hours)
    account ||= @current_test_account
    token = generate_jwt_for(user, account: account, expires_in: expires_in)
    timestamp = Time.current.to_i
    signature = generate_internal_api_signature(timestamp)

    {
      'Authorization' => "Bearer #{token}",
      'X-Signature' => signature,
      'X-Timestamp' => timestamp.to_s
    }
  end

  def invalid_auth_headers
    {'Authorization' => "Bearer invalid_token"}
  end

  def expired_jwt_for(user)
    generate_jwt_for(user, expires_in: -1.hour)
  end

  def expired_auth_headers_for(user)
    token = expired_jwt_for(user)
    {'Authorization' => "Bearer #{token}"}
  end

  private

  def generate_internal_api_signature(timestamp)
    OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)
  end
end

RSpec.configure do |config|
  config.include JwtHelpers, type: :request
end
