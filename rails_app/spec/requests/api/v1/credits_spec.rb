# frozen_string_literal: true

require "rails_helper"

RSpec.describe "API::V1::Credits", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  describe "GET /api/v1/credits/check" do
    let(:account) { create(:account) }

    # Internal service authentication helpers (same pattern as llm_usage_spec)
    def generate_internal_signature(ts)
      secret = Rails.application.credentials.devise_jwt_secret_key!
      OpenSSL::HMAC.hexdigest("SHA256", secret, ts)
    end

    def internal_headers(timestamp = Time.current.to_i.to_s)
      sig = generate_internal_signature(timestamp)
      {
        "X-Signature" => sig,
        "X-Timestamp" => timestamp
      }
    end

    def setup_account_credits(plan_millicredits:, pack_millicredits: 0)
      total = plan_millicredits + pack_millicredits
      account.update!(
        plan_millicredits: plan_millicredits,
        pack_millicredits: pack_millicredits,
        total_millicredits: total
      )
    end

    context "with valid internal service authentication" do
      it "returns ok=true when account has positive balance" do
        setup_account_credits(plan_millicredits: 5_000_000) # 5000 credits

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["ok"]).to be true
        expect(json["balance_millicredits"]).to eq(5_000_000)
        expect(json["plan_millicredits"]).to eq(5_000_000)
        expect(json["pack_millicredits"]).to eq(0)
      end

      it "returns ok=true when account has only pack credits" do
        setup_account_credits(plan_millicredits: 0, pack_millicredits: 1_000_000)

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["ok"]).to be true
        expect(json["balance_millicredits"]).to eq(1_000_000)
        expect(json["plan_millicredits"]).to eq(0)
        expect(json["pack_millicredits"]).to eq(1_000_000)
      end

      it "returns ok=false when account has zero balance" do
        setup_account_credits(plan_millicredits: 0, pack_millicredits: 0)

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["ok"]).to be false
        expect(json["balance_millicredits"]).to eq(0)
      end

      it "returns ok=false when account has negative balance (debt)" do
        # Simulate debt scenario
        account.update!(
          plan_millicredits: -500_000,
          pack_millicredits: 0,
          total_millicredits: -500_000
        )

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["ok"]).to be false
        expect(json["balance_millicredits"]).to eq(-500_000)
      end

      it "returns 404 for non-existent account" do
        get "/api/v1/credits/check",
            params: { account_id: 999999 },
            headers: internal_headers

        expect(response).to have_http_status(:not_found)
      end

      it "returns breakdown of plan and pack credits" do
        setup_account_credits(plan_millicredits: 3_000_000, pack_millicredits: 2_000_000)

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["ok"]).to be true
        expect(json["balance_millicredits"]).to eq(5_000_000)
        expect(json["plan_millicredits"]).to eq(3_000_000)
        expect(json["pack_millicredits"]).to eq(2_000_000)
      end
    end

    context "without internal service authentication" do
      it "returns 401 when no signature provided" do
        setup_account_credits(plan_millicredits: 5_000_000)

        get "/api/v1/credits/check",
            params: { account_id: account.id }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 with invalid signature" do
        setup_account_credits(plan_millicredits: 5_000_000)

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: {
              "X-Signature" => "invalid_signature",
              "X-Timestamp" => Time.current.to_i.to_s
            }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 with expired timestamp (> 5 minutes old)" do
        setup_account_credits(plan_millicredits: 5_000_000)
        old_timestamp = 10.minutes.ago.to_i.to_s

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers(old_timestamp)

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 if Authorization header is present" do
        setup_account_credits(plan_millicredits: 5_000_000)

        get "/api/v1/credits/check",
            params: { account_id: account.id },
            headers: internal_headers.merge("Authorization" => "Bearer fake_token")

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "parameter validation" do
      it "returns 400 when account_id is missing" do
        get "/api/v1/credits/check",
            headers: internal_headers

        expect(response).to have_http_status(:bad_request)
      end
    end
  end
end
