# frozen_string_literal: true

require "rails_helper"

RSpec.describe "API::V1::LLMUsage", type: :request do
  describe "POST /api/v1/llm_usage/notify" do
    let(:run_id) { "run_#{SecureRandom.hex(8)}" }
    let(:timestamp) { Time.current.to_i.to_s }
    let(:signature) { generate_internal_signature(timestamp) }

    context "with valid internal service auth" do
      it "enqueues ChargeRunWorker and returns 202" do
        expect(Credits::ChargeRunWorker).to receive(:perform_async).with(run_id)

        post "/api/v1/llm_usage/notify", params: { run_id: run_id }, headers: internal_headers

        expect(response).to have_http_status(:accepted)
      end

      it "returns 422 when run_id is missing" do
        post "/api/v1/llm_usage/notify", params: {}, headers: internal_headers

        expect(response).to have_http_status(:unprocessable_entity)
        expect(JSON.parse(response.body)["error"]).to eq("run_id is required")
      end

      it "returns 422 when run_id is blank" do
        post "/api/v1/llm_usage/notify", params: { run_id: "" }, headers: internal_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "without internal service auth" do
      it "returns 401 when signature is missing" do
        post "/api/v1/llm_usage/notify",
          params: { run_id: run_id },
          headers: { "X-Timestamp" => timestamp }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when timestamp is missing" do
        post "/api/v1/llm_usage/notify",
          params: { run_id: run_id },
          headers: { "X-Signature" => signature }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when signature is invalid" do
        post "/api/v1/llm_usage/notify",
          params: { run_id: run_id },
          headers: { "X-Signature" => "invalid", "X-Timestamp" => timestamp }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when timestamp is too old" do
        old_timestamp = 10.minutes.ago.to_i.to_s
        old_signature = generate_internal_signature(old_timestamp)

        post "/api/v1/llm_usage/notify",
          params: { run_id: run_id },
          headers: { "X-Signature" => old_signature, "X-Timestamp" => old_timestamp }

        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)["error"]).to eq("Request timestamp too old")
      end
    end

    context "with Authorization header (should be rejected)" do
      it "returns 401 for internal service calls that include Authorization" do
        post "/api/v1/llm_usage/notify",
          params: { run_id: run_id },
          headers: internal_headers.merge("Authorization" => "Bearer some_jwt_token")

        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)["error"]).to include("must not include Authorization")
      end
    end
  end
end
