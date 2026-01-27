# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Settings Inertia Page', type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }

  describe 'GET /settings' do
    context 'when user is subscribed' do
      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
        sign_in user
      end

      it 'renders the Settings component' do
        get settings_path

        expect(response).to have_http_status(:ok)
        expect(inertia.component).to eq('Settings')
      end

      it 'props conform to Settings schema' do
        get settings_path

        expect_inertia_props_to_match_schema(InertiaSchemas::Settings.props_schema)
      end

      it 'includes user props with correct email' do
        get settings_path

        user_props = inertia.props[:user]
        expect(user_props[:id]).to eq(user.id)
        expect(user_props[:email]).to eq(user.email)
        expect(user_props[:name]).to eq(user.name)
      end

      it 'includes credit balance from Account model' do
        get settings_path

        credit_props = inertia.props[:credit_balance]
        expect(credit_props[:plan_credits]).to eq(account.plan_credits)
        expect(credit_props[:pack_credits]).to eq(account.pack_credits)
        expect(credit_props[:total_credits]).to eq(account.total_credits)
        expect(credit_props[:plan_credit_limit]).to eq(account.plan&.credits || 0)
      end

      it 'includes subscription props with plan details' do
        get settings_path

        sub_props = inertia.props[:subscription]
        expect(sub_props).not_to be_nil
        expect(sub_props[:plan_name]).to be_present
        expect(sub_props[:interval]).to eq('month')
        expect(sub_props[:features]).to be_an(Array)
      end

      it 'includes subscription with period dates' do
        subscription = account.subscriptions.active.first
        subscription.update!(
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )

        get settings_path

        sub_props = inertia.props[:subscription]
        expect(sub_props[:current_period_start]).to be_present
        expect(sub_props[:current_period_end]).to be_present
      end

      it 'includes stripe_portal_url as nil for fake_processor' do
        get settings_path

        # fake_processor doesn't generate real portal URLs
        expect(inertia.props[:stripe_portal_url]).to be_nil
      end
    end

    context 'when user has no active subscription' do
      before do
        ensure_plans_exist
        sign_in user
      end

      it 'renders the Settings component' do
        get settings_path

        expect(response).to have_http_status(:ok)
        expect(inertia.component).to eq('Settings')
      end

      it 'props conform to Settings schema with nil subscription' do
        get settings_path

        expect_inertia_props_to_match_schema(InertiaSchemas::Settings.props_schema)
        expect(inertia.props[:subscription]).to be_nil
      end

      it 'includes credit balance with zero values' do
        get settings_path

        credit_props = inertia.props[:credit_balance]
        expect(credit_props[:plan_credits]).to eq(0)
        expect(credit_props[:plan_credit_limit]).to eq(0)
      end
    end

    context 'when user is not authenticated' do
      it 'returns 404 (route only exists for authenticated users)' do
        get "/settings"

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'with billing history' do
      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")

        # Create Pay::Charge records
        account.payment_processor.charges.create!(
          processor_id: "ch_test_#{SecureRandom.hex(8)}",
          amount: 14900,
          currency: "usd",
          created_at: 1.week.ago
        )

        sign_in user
      end

      it 'includes billing history from Pay::Charge' do
        get settings_path

        billing_history = inertia.props[:billing_history]
        expect(billing_history).to be_an(Array)
        expect(billing_history.length).to be > 0
        expect(billing_history.first[:amount_cents]).to eq(14900)
      end
    end
  end

  describe 'PATCH /settings' do
    before do
      ensure_plans_exist
      subscribe_account(account, plan_name: "growth_monthly")
      sign_in user
    end

    it 'updates user profile with valid params' do
      patch settings_path, params: {
        user: { first_name: "Updated", last_name: "Name" }
      }

      expect(response).to redirect_to(settings_path)
      expect(user.reload.first_name).to eq("Updated")
      expect(user.reload.last_name).to eq("Name")
    end

    it 'includes success notice' do
      patch settings_path, params: {
        user: { first_name: "Test", last_name: "User" }
      }

      follow_redirect!
      expect(inertia.props[:flash]).to include(
        hash_including("type" => "success")
      ).or include(
        hash_including(type: "success")
      )
    end
  end
end
