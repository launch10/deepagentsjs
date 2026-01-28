# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Madmin::User::CreditTransactions", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:user, :admin) }
  let(:target_user) { create(:user) }

  before do
    ensure_plans_exist
    subscribe_account(admin.owned_account, plan_name: "growth_monthly")
    subscribe_account(target_user.owned_account, plan_name: "growth_monthly")
    sign_in admin
  end

  describe "GET /admin/users/:user_id/credit_transactions" do
    it "renders the Inertia page" do
      get madmin_user_credit_transactions_path(target_user)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "GET /admin/users/:user_id/credit_transactions.json" do
    it "returns paginated JSON" do
      3.times do |i|
        create(:credit_transaction, :skip_validation,
          account: target_user.owned_account,
          transaction_type: "allocate",
          credit_type: "plan",
          reason: "plan_renewal",
          amount_millicredits: (i + 1) * 1_000_000,
          balance_after_millicredits: (i + 1) * 1_000_000,
          plan_balance_after_millicredits: (i + 1) * 1_000_000,
          pack_balance_after_millicredits: 0)
      end

      get madmin_user_credit_transactions_path(target_user, format: :json)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["transactions"].length).to eq(3)
      expect(body["pagination"]["current_page"]).to eq(1)
      expect(body["pagination"]["total_count"]).to eq(3)
    end

    it "returns transactions in reverse chronological order" do
      old_txn = create(:credit_transaction, :skip_validation,
        account: target_user.owned_account,
        amount_millicredits: 1_000_000,
        balance_after_millicredits: 1_000_000,
        plan_balance_after_millicredits: 1_000_000,
        pack_balance_after_millicredits: 0,
        created_at: 2.days.ago)
      new_txn = create(:credit_transaction, :skip_validation,
        account: target_user.owned_account,
        amount_millicredits: 2_000_000,
        balance_after_millicredits: 2_000_000,
        plan_balance_after_millicredits: 2_000_000,
        pack_balance_after_millicredits: 0,
        created_at: 1.hour.ago)

      get madmin_user_credit_transactions_path(target_user, format: :json)

      body = JSON.parse(response.body)
      ids = body["transactions"].map { |t| t["id"] }
      expect(ids).to eq([new_txn.id, old_txn.id])
    end

    it "returns correct serialized fields with credit-converted amounts" do
      txn = create(:credit_transaction, :skip_validation,
        account: target_user.owned_account,
        transaction_type: "consume",
        credit_type: "plan",
        reason: "ai_generation",
        amount_millicredits: -500_000,
        balance_after_millicredits: 500_000,
        plan_balance_after_millicredits: 500_000,
        pack_balance_after_millicredits: 0,
        reference_type: "Website",
        reference_id: "42")

      get madmin_user_credit_transactions_path(target_user, format: :json)

      body = JSON.parse(response.body)
      t = body["transactions"].first
      expect(t["id"]).to eq(txn.id)
      expect(t["transaction_type"]).to eq("consume")
      expect(t["credit_type"]).to eq("plan")
      expect(t["reason"]).to eq("ai_generation")
      expect(t["amount"]).to eq(-500.0)
      expect(t["balance_after"]).to eq(500.0)
      expect(t["plan_balance_after"]).to eq(500.0)
      expect(t["pack_balance_after"]).to eq(0.0)
      expect(t["reference_type"]).to eq("Website")
      expect(t["reference_id"]).to eq("42")
      expect(t["created_at"]).to be_present
    end

    it "scopes transactions to the user's owned account" do
      other_user = create(:user)
      subscribe_account(other_user.owned_account, plan_name: "growth_monthly")

      create(:credit_transaction, :skip_validation,
        account: target_user.owned_account,
        amount_millicredits: 1_000_000,
        balance_after_millicredits: 1_000_000,
        plan_balance_after_millicredits: 1_000_000,
        pack_balance_after_millicredits: 0)
      create(:credit_transaction, :skip_validation,
        account: other_user.owned_account,
        amount_millicredits: 2_000_000,
        balance_after_millicredits: 2_000_000,
        plan_balance_after_millicredits: 2_000_000,
        pack_balance_after_millicredits: 0)

      get madmin_user_credit_transactions_path(target_user, format: :json)

      body = JSON.parse(response.body)
      expect(body["transactions"].length).to eq(1)
      expect(body["transactions"].first["amount"]).to eq(1000.0)
    end

    it "paginates at 20 per page" do
      22.times do |i|
        create(:credit_transaction, :skip_validation,
          account: target_user.owned_account,
          amount_millicredits: (i + 1) * 1000,
          balance_after_millicredits: (i + 1) * 1000,
          plan_balance_after_millicredits: (i + 1) * 1000,
          pack_balance_after_millicredits: 0)
      end

      get madmin_user_credit_transactions_path(target_user, format: :json, page: 1)

      body = JSON.parse(response.body)
      expect(body["transactions"].length).to eq(20)
      expect(body["pagination"]["total_pages"]).to eq(2)
      expect(body["pagination"]["next_page"]).to eq(2)
      expect(body["pagination"]["prev_page"]).to be_nil

      get madmin_user_credit_transactions_path(target_user, format: :json, page: 2)

      body = JSON.parse(response.body)
      expect(body["transactions"].length).to eq(2)
      expect(body["pagination"]["prev_page"]).to eq(1)
      expect(body["pagination"]["next_page"]).to be_nil
    end

    context "when not authenticated as admin" do
      before { sign_in target_user }

      it "blocks non-admin access" do
        get madmin_user_credit_transactions_path(target_user, format: :json)

        expect(response).not_to have_http_status(:ok)
      end
    end
  end
end
