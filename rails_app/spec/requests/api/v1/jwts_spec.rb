# frozen_string_literal: true

require "rails_helper"

RSpec.describe "JWT Refresh API", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  describe "POST /api/v1/jwt" do
    context "with a signed-in user (Devise session)" do
      it "returns 200 with a fresh JWT" do
        sign_in user

        post "/api/v1/jwt"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["jwt"]).to be_present

        # Decode and verify the JWT contents
        secret = Rails.application.credentials.devise_jwt_secret_key
        payload = JWT.decode(json["jwt"], secret, true, {algorithm: "HS256"})[0]
        expect(payload["sub"]).to eq(user.id)
        expect(payload["account_id"]).to eq(account.id)
        expect(payload["exp"]).to be > Time.current.to_i
      end
    end

    context "without authentication" do
      it "returns 401" do
        post "/api/v1/jwt"

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
