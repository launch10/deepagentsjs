require 'rails_helper'

RSpec.describe "Model Configs API", type: :request do
  let!(:opus) { create(:model_config, :opus) }
  let!(:sonnet) { create(:model_config, :sonnet) }
  let!(:haiku) { create(:model_config, :haiku) }

  describe "GET /api/v1/model_configs" do
    context "with valid internal API signature" do
      it "returns all model configs keyed by model_key" do
        timestamp = Time.current.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)

        get "/api/v1/model_configs",
          headers: {
            'X-Signature' => signature,
            'X-Timestamp' => timestamp.to_s
          }

        expect(response).to have_http_status(:ok)

        data = JSON.parse(response.body)
        expect(data).to have_key('models')
        expect(data).to have_key('updatedAt')

        models = data['models']
        expect(models).to have_key('opus')
        expect(models).to have_key('sonnet')
        expect(models).to have_key('haiku')

        # Check opus config values
        expect(models['opus']['enabled']).to eq(false)
        expect(models['opus']['maxUsagePercent']).to eq(80)
        expect(models['opus']['costIn']).to eq(15.0)
        expect(models['opus']['costOut']).to eq(75.0)

        # Check sonnet config values
        expect(models['sonnet']['enabled']).to eq(true)
        expect(models['sonnet']['maxUsagePercent']).to eq(90)
      end

      it "returns updatedAt timestamp" do
        timestamp = Time.current.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)

        get "/api/v1/model_configs",
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
        get "/api/v1/model_configs"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with invalid signature" do
      it "returns unauthorized" do
        timestamp = Time.current.to_i

        get "/api/v1/model_configs",
          headers: {
            'X-Signature' => 'invalid_signature',
            'X-Timestamp' => timestamp.to_s
          }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with expired timestamp" do
      it "returns unauthorized for timestamps older than 5 minutes" do
        timestamp = 6.minutes.ago.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', jwt_secret, timestamp.to_s)

        get "/api/v1/model_configs",
          headers: {
            'X-Signature' => signature,
            'X-Timestamp' => timestamp.to_s
          }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
