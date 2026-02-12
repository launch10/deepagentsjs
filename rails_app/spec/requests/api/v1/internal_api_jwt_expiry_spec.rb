# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Internal API JWT Expiry Handling", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
    account.update!(plan_millicredits: 5_000_000, pack_millicredits: 0, total_millicredits: 5_000_000)
  end

  describe "GET /api/v1/credits/check" do
    context "with expired JWT + valid HMAC (the belt fix)" do
      it "returns 200 — HMAC proves trust, expiry is skipped" do
        expired_token = expired_jwt_for(user)
        timestamp = Time.current.to_i.to_s
        signature = generate_internal_signature(timestamp)

        get "/api/v1/credits/check", headers: {
          "Authorization" => "Bearer #{expired_token}",
          "X-Signature" => signature,
          "X-Timestamp" => timestamp
        }

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["ok"]).to be true
      end
    end

    context "with expired JWT + no HMAC (unchanged behavior)" do
      it "returns 401" do
        expired_token = expired_jwt_for(user)

        get "/api/v1/credits/check", headers: {
          "Authorization" => "Bearer #{expired_token}"
        }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with garbled JWT + valid HMAC" do
      it "returns 401 — signature verification still fails on garbled tokens" do
        timestamp = Time.current.to_i.to_s
        signature = generate_internal_signature(timestamp)

        get "/api/v1/credits/check", headers: {
          "Authorization" => "Bearer totally.garbled.nonsense",
          "X-Signature" => signature,
          "X-Timestamp" => timestamp
        }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with valid JWT + valid HMAC (happy path)" do
      it "returns 200" do
        headers = auth_headers_for(user)

        get "/api/v1/credits/check", headers: headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["ok"]).to be true
      end
    end
  end
end
