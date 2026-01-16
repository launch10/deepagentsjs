module Madmin
  class ApplicationController < Madmin::BaseController
    include Devise::Controllers::Helpers

    before_action :authenticate_admin_user
    around_action :without_tenant if defined? ActsAsTenant

    impersonates :user

    inertia_share do
      {
        current_user: current_user&.slice(:id, :name, :email),
        true_user: true_user&.slice(:id, :name, :email),
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
  end
end
