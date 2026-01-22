require 'rails_helper'

RSpec.describe "Madmin::User::Impersonates", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:user, :admin) }
  let(:target_user) { create(:user) }

  before do
    ensure_plans_exist
    subscribe_account(admin.owned_account, plan_name: "growth_monthly")
    subscribe_account(target_user.owned_account, plan_name: "growth_monthly")
    sign_in admin
  end

  describe "POST /admin/users/:user_id/impersonate" do
    it "sets the session account_id to the target user's account" do
      post madmin_user_impersonate_path(target_user)

      expect(session[:account_id]).to eq(target_user.primary_account.id)
    end

    it "regenerates the JWT with the target user's credentials" do
      post madmin_user_impersonate_path(target_user)

      jwt_payload = decode_jwt(cookies[:jwt])
      expect(jwt_payload["sub"]).to eq(target_user.id)
      expect(jwt_payload["account_id"]).to eq(target_user.primary_account.id)
    end

    it "redirects to the root path" do
      post madmin_user_impersonate_path(target_user)

      expect(response).to redirect_to(root_path)
    end
  end

  describe "DELETE /admin/users/:user_id/impersonate" do
    before do
      # First impersonate the user
      post madmin_user_impersonate_path(target_user)
    end

    it "restores the admin's JWT" do
      delete madmin_user_impersonate_path(target_user)

      jwt_payload = decode_jwt(cookies[:jwt])
      expect(jwt_payload["sub"]).to eq(admin.id)
      expect(jwt_payload["account_id"]).to eq(admin.primary_account.id)
    end

    it "restores the admin's session account_id" do
      delete madmin_user_impersonate_path(target_user)

      expect(session[:account_id]).to eq(admin.primary_account.id)
    end

    it "redirects to the user's madmin page" do
      delete madmin_user_impersonate_path(target_user)

      expect(response).to redirect_to(madmin_user_path(target_user))
    end
  end

  private

  def decode_jwt(jwt)
    JWT.decode(jwt, Rails.application.credentials.devise_jwt_secret_key, true, algorithm: "HS256").first
  end
end
