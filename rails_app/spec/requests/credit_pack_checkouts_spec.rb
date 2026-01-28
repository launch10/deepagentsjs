# frozen_string_literal: true

require "rails_helper"

RSpec.describe "CreditPackCheckouts", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999, name: "test_pack", stripe_price_id: "price_test123") }

  describe "POST /credit_packs/:id/checkout" do
    context "when user is not authenticated" do
      it "redirects to sign in" do
        post "/credit_packs/#{credit_pack.id}/checkout"
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    context "when user is authenticated but has no active subscription" do
      before { sign_in user }

      it "returns forbidden status" do
        post "/credit_packs/#{credit_pack.id}/checkout"
        expect(response).to have_http_status(:forbidden)
      end

      it "returns error message in JSON" do
        post "/credit_packs/#{credit_pack.id}/checkout"
        expect(JSON.parse(response.body)).to include("error" => "Active subscription required to purchase credits")
      end
    end

    context "when user has an active subscription" do
      let(:checkout_session) { double("checkout_session", client_secret: "cs_test_secret") }
      let(:mock_payment_processor) { double("payment_processor") }

      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
        sign_in user

        # Stub the payment processor's checkout method
        allow_any_instance_of(CreditPackCheckoutsController).to receive(:create_checkout_session)
          .and_return(checkout_session)
      end

      it "returns success status" do
        post "/credit_packs/#{credit_pack.id}/checkout"
        expect(response).to have_http_status(:ok)
      end

      it "returns checkout session client_secret as JSON" do
        post "/credit_packs/#{credit_pack.id}/checkout"
        expect(JSON.parse(response.body)).to include("client_secret" => "cs_test_secret")
      end
    end

    context "when credit pack does not have stripe_price_id" do
      let!(:credit_pack_no_stripe) { create(:credit_pack, credits: 500, price_cents: 2999, name: "no_stripe_pack", stripe_price_id: nil) }

      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
        sign_in user
      end

      it "returns unprocessable entity status" do
        post "/credit_packs/#{credit_pack_no_stripe.id}/checkout"
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "returns error message in JSON" do
        post "/credit_packs/#{credit_pack_no_stripe.id}/checkout"
        expect(JSON.parse(response.body)).to include("error")
      end
    end

    context "when credit pack is not found" do
      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
        sign_in user
      end

      it "returns not found status" do
        post "/credit_packs/999999/checkout"
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
