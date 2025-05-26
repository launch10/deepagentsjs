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

  def set_jwt_cookie
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

  def jwt_user
    payload = JWT.decode(cookies[:jwt], Rails.application.credentials.devise_jwt_secret_key!, true, { algorithm: 'HS256' })
    return nil if payload.blank? || payload[0]["sub"].blank?

    User.find(payload[0]["sub"])
  end

  private

  # You can also customize the messages using the policy and action to generate the I18n key
  # https://github.com/varvet/pundit#creating-custom-error-messages
  def user_not_authorized
    redirect_back_or_to root_path, alert: t("unauthorized")
  end

end
