require 'rails_helper'

RSpec.describe "Model Fallback Chains API", type: :request do
  let!(:paid_slow_coding) do
    create(:model_fallback_chain,
           cost_tier: "paid", speed_tier: "slow", skill: "coding",
           model_keys: %w[opus sonnet haiku gpt5])
  end
  let!(:paid_fast_writing) do
    create(:model_fallback_chain,
           cost_tier: "paid", speed_tier: "fast", skill: "writing",
           model_keys: %w[haiku sonnet])
  end
  let!(:free_slow_planning) do
    create(:model_fallback_chain,
           cost_tier: "free", speed_tier: "slow", skill: "planning",
           model_keys: %w[gpt_oss])
  end

  describe "GET /api/v1/model_fallback_chains" do
    context "with valid internal API signature" do
      it "returns all fallback chains in nested structure" do
        timestamp = Time.current.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)

        get "/api/v1/model_fallback_chains",
          headers: {
            'X-Signature' => signature,
            'X-Timestamp' => timestamp.to_s
          }

        expect(response).to have_http_status(:ok)

        data = JSON.parse(response.body)
        expect(data).to have_key('chains')
        expect(data).to have_key('updatedAt')

        chains = data['chains']

        # Check nested structure
        expect(chains.dig('paid', 'slow', 'coding')).to eq(%w[opus sonnet haiku gpt5])
        expect(chains.dig('paid', 'fast', 'writing')).to eq(%w[haiku sonnet])
        expect(chains.dig('free', 'slow', 'planning')).to eq(%w[gpt_oss])
      end

      it "returns updatedAt timestamp" do
        timestamp = Time.current.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)

        get "/api/v1/model_fallback_chains",
          headers: {
            'X-Signature' => signature,
            'X-Timestamp' => timestamp.to_s
          }

        data = JSON.parse(response.body)
        expect(data['updatedAt']).to be_present
      end
    end

    context "without internal API signature" do
      it "returns unauthorized" do
        get "/api/v1/model_fallback_chains"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with invalid signature" do
      it "returns unauthorized" do
        timestamp = Time.current.to_i

        get "/api/v1/model_fallback_chains",
          headers: {
            'X-Signature' => 'invalid_signature',
            'X-Timestamp' => timestamp.to_s
          }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
