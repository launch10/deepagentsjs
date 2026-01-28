module Madmin
  class ApplicationController < Madmin::BaseController
    include Devise::Controllers::Helpers

    before_action :authenticate_admin_user
    before_action :stop_impersonating_on_admin_access
    around_action :without_tenant if defined? ActsAsTenant

    impersonates :user

    inertia_share do
      {
        current_user: current_user ? current_user.slice(:id, :name, :email).merge(admin: current_user.admin?) : nil,
        true_user: true_user ? true_user.slice(:id, :name, :email).merge(admin: true_user.admin?) : nil,
        impersonating: current_user && true_user && current_user.id != true_user.id
      }
    end

    def authenticate_admin_user
      # First check if user is signed in at all
      unless user_signed_in?
        store_location_for(:user, request.fullpath)
        redirect_to main_app.new_user_session_path, alert: I18n.t("devise.failure.unauthenticated")
        return
      end

      # Then check if they're an admin
      unless true_user&.admin?
        redirect_to main_app.root_path, alert: "You must be an admin to access this area."
      end
    end

    def without_tenant
      ActsAsTenant.without_tenant do
        yield
      end
    end

    def stop_impersonating_on_admin_access
      return unless impersonating?

      stop_impersonating_user

      # Restore session and JWT for the admin (true_user is now current_user)
      session[:account_id] = current_user.primary_account&.id
      set_admin_jwt_cookie(current_user, current_user.primary_account)
    end

    def impersonating?
      true_user && current_user && true_user.id != current_user.id
    end

    def set_admin_jwt_cookie(user, account)
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
end
