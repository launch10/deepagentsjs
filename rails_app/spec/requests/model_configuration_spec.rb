require "swagger_helper"

RSpec.describe "Model Configuration API", type: :request do
  def generate_internal_api_signature(timestamp)
    secret = Rails.application.credentials.devise_jwt_secret_key!
    OpenSSL::HMAC.hexdigest("SHA256", secret, timestamp.to_s)
  end

  path "/api/v1/model_configuration" do
    get "Retrieves model configuration" do
      tags "Model Configuration"
      produces "application/json"
      description "Returns all model configurations and preferences. Used by Langgraph to fetch LLM settings."
      parameter name: "X-Signature", in: :header, type: :string, required: true,
        description: "HMAC signature for internal API authentication"
      parameter name: "X-Timestamp", in: :header, type: :string, required: true,
        description: "Unix timestamp for signature verification"

      response "200", "model configuration retrieved successfully" do
        schema APISchemas::ModelConfiguration.response

        before do
          # Create model configs
          create(:model_config, model_key: "opus", enabled: false, max_usage_percent: 80, model_card: "claude-opus-4-5")
          create(:model_config, model_key: "sonnet", enabled: true, max_usage_percent: 90, model_card: "claude-sonnet-4-5")
          create(:model_config, model_key: "haiku", enabled: true, max_usage_percent: 95, model_card: "claude-haiku-4-5")

          # Create model preferences
          create(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding", model_keys: %w[opus sonnet haiku])
          create(:model_preference, cost_tier: "paid", speed_tier: "fast", skill: "writing", model_keys: %w[haiku sonnet])
          create(:model_preference, cost_tier: "free", speed_tier: "slow", skill: "planning", model_keys: %w[gpt_oss])
        end

        let(:timestamp) { Time.now.to_i.to_s }
        let(:"X-Signature") { generate_internal_api_signature(timestamp) }
        let(:"X-Timestamp") { timestamp }

        run_test! do |response|
          json = JSON.parse(response.body)

          # Verify models section
          expect(json["models"]).to be_a(Hash)
          expect(json["models"]["opus"]).to include(
            "enabled" => false,
            "maxUsagePercent" => 80,
            "modelCard" => "claude-opus-4-5",
            "priceTier" => be_a(Integer)
          )
          expect(json["models"]["sonnet"]).to include(
            "enabled" => true,
            "maxUsagePercent" => 90,
            "priceTier" => be_a(Integer)
          )

          # Verify preferences section
          expect(json["preferences"]).to be_a(Hash)
          expect(json["preferences"]["paid"]["slow"]["coding"]).to eq(%w[opus sonnet haiku])
          expect(json["preferences"]["paid"]["fast"]["writing"]).to eq(%w[haiku sonnet])
          expect(json["preferences"]["free"]["slow"]["planning"]).to eq(%w[gpt_oss])

          # Verify updatedAt
          expect(json["updatedAt"]).to be_present
        end
      end

      response "401", "unauthorized - missing signature or timestamp" do
        schema APISchemas::ModelConfiguration.error_response

        let(:"X-Signature") { nil }
        let(:"X-Timestamp") { nil }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to eq("Missing signature or timestamp")
        end
      end

      response "401", "unauthorized - invalid signature" do
        schema APISchemas::ModelConfiguration.error_response

        let(:timestamp) { Time.now.to_i.to_s }
        let(:"X-Signature") { "invalid_signature" }
        let(:"X-Timestamp") { timestamp }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to eq("Invalid signature")
        end
      end

      response "401", "unauthorized - timestamp too old" do
        schema APISchemas::ModelConfiguration.error_response

        let(:old_timestamp) { (Time.now - 10.minutes).to_i.to_s }
        let(:"X-Signature") { generate_internal_api_signature(old_timestamp) }
        let(:"X-Timestamp") { old_timestamp }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to eq("Request timestamp too old")
        end
      end
    end
  end
end
