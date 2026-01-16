class Madmin::User::ImpersonatesController < Madmin::ApplicationController
  def create
    user = ::User.find(params[:user_id])
    impersonate_user(user)

    # Update session and JWT for impersonated user
    session[:account_id] = user.primary_account&.id
    set_jwt_cookie(user, user.primary_account)

    redirect_to main_app.root_path, status: :see_other
  end

  def destroy
    impersonated_user = current_user
    stop_impersonating_user

    # After stopping, current_user is the admin again (true_user)
    session[:account_id] = current_user.primary_account&.id
    set_jwt_cookie(current_user, current_user.primary_account)

    redirect_to main_app.madmin_user_path(impersonated_user), status: :see_other
  end

  private

  def set_jwt_cookie(user, account)
    return unless user && account

    payload = {
      jti: SecureRandom.uuid,
      sub: user.id,
      account_id: account.id,
      exp: 24.hours.from_now.to_i,
      iat: Time.current.to_i
    }

    token = JWT.encode(payload, Rails.application.credentials.devise_jwt_secret_key!, "HS256")

    cookies[:jwt] = {
      value: token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax
    }
  end
end
