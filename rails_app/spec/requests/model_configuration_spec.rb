require "rails_helper"

RSpec.describe "API::V1::ModelConfiguration", type: :request do
  describe "GET /api/v1/model_configuration" do
    let(:timestamp) { Time.now.to_i.to_s }
    let(:signature) { generate_internal_api_signature(timestamp) }

    def generate_internal_api_signature(timestamp)
      secret = Rails.application.credentials.devise_jwt_secret_key!
      OpenSSL::HMAC.hexdigest("SHA256", secret, timestamp.to_s)
    end

    context "with valid authentication" do
      before do
        # Create some model configs
        create(:model_config, model_key: "opus", enabled: false, max_usage_percent: 80, model_card: "claude-opus-4-5")
        create(:model_config, model_key: "sonnet", enabled: true, max_usage_percent: 90, model_card: "claude-sonnet-4-5")
        create(:model_config, model_key: "haiku", enabled: true, max_usage_percent: 95, model_card: "claude-haiku-4-5")

        # Create some model preferences
        create(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding", model_keys: %w[opus sonnet haiku])
        create(:model_preference, cost_tier: "paid", speed_tier: "fast", skill: "writing", model_keys: %w[haiku sonnet])
        create(:model_preference, cost_tier: "free", speed_tier: "slow", skill: "planning", model_keys: %w[gpt_oss])
      end

      it "returns unified model configuration" do
        get "/api/v1/model_configuration",
          headers: {"X-Signature" => signature, "X-Timestamp" => timestamp}

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        # Check models section
        expect(json["models"]).to be_a(Hash)
        expect(json["models"]["opus"]).to include(
          "enabled" => false,
          "maxUsagePercent" => 80,
          "modelCard" => "claude-opus-4-5"
        )
        expect(json["models"]["sonnet"]).to include(
          "enabled" => true,
          "maxUsagePercent" => 90
        )

        # Check preferences section
        expect(json["preferences"]).to be_a(Hash)
        expect(json["preferences"]["paid"]["slow"]["coding"]).to eq(%w[opus sonnet haiku])
        expect(json["preferences"]["paid"]["fast"]["writing"]).to eq(%w[haiku sonnet])
        expect(json["preferences"]["free"]["slow"]["planning"]).to eq(%w[gpt_oss])

        # Check updatedAt
        expect(json["updatedAt"]).to be_present
      end
    end

    context "without authentication" do
      it "returns unauthorized without signature" do
        get "/api/v1/model_configuration"

        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json["error"]).to eq("Missing signature or timestamp")
      end

      it "returns unauthorized with invalid signature" do
        get "/api/v1/model_configuration",
          headers: {"X-Signature" => "invalid", "X-Timestamp" => timestamp}

        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json["error"]).to eq("Invalid signature")
      end

      it "returns unauthorized with old timestamp" do
        old_timestamp = (Time.now - 10.minutes).to_i.to_s
        old_signature = generate_internal_api_signature(old_timestamp)

        get "/api/v1/model_configuration",
          headers: {"X-Signature" => old_signature, "X-Timestamp" => old_timestamp}

        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json["error"]).to eq("Request timestamp too old")
      end
    end
  end
end
