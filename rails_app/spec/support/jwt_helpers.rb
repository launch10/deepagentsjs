# Helper methods for JWT authentication in request specs
module JwtHelpers
  def jwt_secret
    Rails.application.credentials.devise_jwt_secret_key
  end

  def generate_jwt_for(user, expires_in: 24.hours)
    payload = {
      jti: SecureRandom.uuid,
      sub: user.id,
      exp: expires_in.from_now.to_i,
      iat: Time.current.to_i,
    }
    JWT.encode(payload, jwt_secret, 'HS256')
  end

  def auth_headers_for(user, expires_in: 24.hours)
    token = generate_jwt_for(user, expires_in: expires_in)
    { 'Authorization' => "Bearer #{token}" }
  end

  def invalid_auth_headers
    { 'Authorization' => "Bearer invalid_token" }
  end

  def expired_jwt_for(user)
    generate_jwt_for(user, expires_in: -1.hour)
  end

  def expired_auth_headers_for(user)
    token = expired_jwt_for(user)
    { 'Authorization' => "Bearer #{token}" }
  end
end