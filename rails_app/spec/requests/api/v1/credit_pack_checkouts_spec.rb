# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Credit Pack Checkouts API", type: :request do
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:credit_pack) { create(:credit_pack, stripe_price_id: "price_test_123") }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  path "/api/v1/credit_packs/{credit_pack_id}/checkout" do
    post "Creates a Stripe checkout session for a credit pack" do
      tags "Credit Packs"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :credit_pack_id, in: :path, type: :integer, required: true, description: "Credit pack ID"
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns checkout session client secret" do
        schema APISchemas::CreditPackCheckout.create_response
        let(:credit_pack_id) { credit_pack.id }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          # Stub Stripe checkout session creation
          checkout_double = double("checkout_session", client_secret: "cs_test_secret_123")
          allow_any_instance_of(Pay::Customer).to receive(:checkout).and_return(checkout_double)
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["client_secret"]).to eq("cs_test_secret_123")
        end
      end

      response "401", "unauthorized - missing token" do
        let(:credit_pack_id) { credit_pack.id }
        let(:Authorization) { nil }

        run_test!
      end

      response "403", "forbidden - no active subscription" do
        let(:credit_pack_id) { credit_pack.id }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          # Cancel the subscription so the account has no active sub
          account.payment_processor.subscription.cancel_now!
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to include("Active subscription required")
        end
      end

      response "404", "credit pack not found" do
        let(:credit_pack_id) { 999_999 }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test!
      end

      response "422", "credit pack has no Stripe price" do
        let!(:free_pack) { create(:credit_pack, stripe_price_id: nil) }
        let(:credit_pack_id) { free_pack.id }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to include("Stripe price")
        end
      end
    end
  end
end
