module Authorization
  # Adds authorization with Pundit to controllers

  extend ActiveSupport::Concern
  include Pundit::Authorization

  included do
    # Uncomment to enforce Pundit authorization for every controller.
    # You will need to add `skip_after_action :verify_authorized` for public controllers.
    #
    # after_action :verify_authorized
    # rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized
  end

  # Use AccountUser since it determines the roles for the current Account
  def pundit_user
    Current.account_user
  end

  def refresh_jwt
    return unless current_user

    payload = {
      jti: current_user.jwt_payload["jti"],
      sub: current_user.id,
      exp: 24.hours.from_now.to_i,
      iat: Time.current.to_i,
    }
  
    token = JWT.encode(payload, Rails.application.credentials.devise_jwt_secret_key!, 'HS256')
  
    cookies[:jwt] = {
      value: token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax
    }
  end

  def jwt_user(allow_headers: false)
    test_jwt_user || real_jwt_user(allow_headers: allow_headers)
  end

  def authenticate_with_jwt!
    begin
      user = jwt_user(allow_headers: true)
    rescue JWT::DecodeError, ActiveRecord::RecordNotFound => e
      render json: { error: 'Not Authorized or invalid token' }, status: :unauthorized
    end

    if user
      Current.user = user
      sign_in(user, store: false)
    else
      render json: { error: 'Missing token' }, status: :unauthorized and return
    end
  end

  private

  def real_jwt_user(allow_headers: false)
    jwt = cookies[:jwt] || (allow_headers ? request.headers['Authorization']&.split(' ')&.last : nil)
    
    if jwt
      payload = jwt_payload(jwt)
      return nil if payload.blank? || payload.dig(0, "sub").blank?

      User.find(payload.dig(0, "sub"))
    end
  end

  def test_jwt_user
    can_use_test_jwt = Rails.env.development? || Rails.env.test?
    return nil unless can_use_test_jwt

    # sent_test_proof = request.headers['X-Test-Proof'] && request.headers['X-Test-Mode'] == 'true'
    # return nil unless sent_test_proof
    
    # test_proof = request.headers['X-Test-Proof']
    # return nil unless test_proof
    
    begin
      payload = JWT.decode(test_proof, Rails.application.credentials.devise_jwt_secret_key!, 'HS256')[0]
      timestamp = payload['timestamp'].to_i

      # Check timestamp is recent (within last minute)
      if Time.at(timestamp / 1000) > 1.minute.ago
        User.find_by(email: 'test_user@abeverything.com')
      else
        nil
      end
    rescue => e
      nil
    end
  end


  # You can also customize the messages using the policy and action to generate the I18n key
  # https://github.com/varvet/pundit#creating-custom-error-messages
  def user_not_authorized
    redirect_back_or_to root_path, alert: t("unauthorized")
  end

  def jwt_expired?
    jwt_payload.nil?
  end

  def jwt_payload(jwt = cookies[:jwt])
    begin
      secret = Rails.application.credentials.devise_jwt_secret_key
      payload = JWT.decode(jwt, secret, true, { algorithm: 'HS256' })
    rescue JWT::DecodeError
      return nil
    end
    payload
  end
end
