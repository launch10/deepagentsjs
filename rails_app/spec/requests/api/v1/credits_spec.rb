# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Credits API", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_account) { user1.owned_account }
  let!(:user2_account) { user2.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(user1_account, plan_name: "growth_monthly")
    subscribe_account(user2_account, plan_name: "growth_monthly")
  end

  # Helper to set up account credits - takes credits, converts to millicredits internally
  def setup_account_credits(account, plan_credits:, pack_credits: 0)
    plan_millicredits = plan_credits * 1000
    pack_millicredits = pack_credits * 1000
    total = plan_millicredits + pack_millicredits
    account.update!(
      plan_millicredits: plan_millicredits,
      pack_millicredits: pack_millicredits,
      total_millicredits: total
    )
  end

  path "/api/v1/credits/check" do
    get "Checks account credit balance" do
      tags "Credits"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns ok=true when account has positive balance" do
        schema APISchemas::Credit.check_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          setup_account_credits(user1_account, plan_credits: 5000)
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["ok"]).to be true
          expect(json["balance_millicredits"]).to eq(5_000_000)
          expect(json["plan_millicredits"]).to eq(5_000_000)
          expect(json["pack_millicredits"]).to eq(0)
        end
      end

      response "200", "returns ok=true when account has only pack credits" do
        schema APISchemas::Credit.check_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          setup_account_credits(user1_account, plan_credits: 0, pack_credits: 1000)
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["ok"]).to be true
          expect(json["balance_millicredits"]).to eq(1_000_000)
          expect(json["plan_millicredits"]).to eq(0)
          expect(json["pack_millicredits"]).to eq(1_000_000)
        end
      end

      response "200", "returns ok=false when account has zero balance" do
        schema APISchemas::Credit.check_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          setup_account_credits(user1_account, plan_credits: 0, pack_credits: 0)
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["ok"]).to be false
          expect(json["balance_millicredits"]).to eq(0)
        end
      end

      response "200", "returns ok=false when account has negative balance (debt)" do
        schema APISchemas::Credit.check_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          # Simulate debt scenario - set millicredits directly for negative balance
          user1_account.update!(
            plan_millicredits: -500_000,
            pack_millicredits: 0,
            total_millicredits: -500_000
          )
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["ok"]).to be false
          expect(json["balance_millicredits"]).to eq(-500_000)
        end
      end

      response "200", "returns breakdown of plan and pack credits" do
        schema APISchemas::Credit.check_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          setup_account_credits(user1_account, plan_credits: 3000, pack_credits: 2000)
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["ok"]).to be true
          expect(json["balance_millicredits"]).to eq(5_000_000)
          expect(json["plan_millicredits"]).to eq(3_000_000)
          expect(json["pack_millicredits"]).to eq(2_000_000)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "unauthorized - invalid token" do
        let(:Authorization) { "Bearer invalid_token" }

        run_test!
      end

      response "401", "unauthorized - expired token" do
        let(:Authorization) { "Bearer #{expired_jwt_for(user1)}" }

        run_test!
      end
    end
  end
end
