# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Madmin::Users", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:user, :admin) }
  let(:target_user) { create(:user) }

  before do
    ensure_plans_exist
    subscribe_account(admin.owned_account, plan_name: "growth_monthly")
    subscribe_account(target_user.owned_account, plan_name: "growth_monthly")
    sign_in admin
  end

  describe "GET /admin/users/:id" do
    it "returns the user detail page" do
      get madmin_user_path(target_user)

      expect(response).to have_http_status(:ok)
    end

    it "includes credit balance information in Inertia props" do
      target_user.owned_account.update!(
        plan_millicredits: 5_000_000,
        pack_millicredits: 2_000_000,
        total_millicredits: 7_000_000
      )

      get madmin_user_path(target_user)

      expect(response).to have_http_status(:ok)
      # Inertia embeds props as JSON in data-page attribute
      page_json = response.body.match(/data-page="([^"]+)"/)[1]
      page_data = JSON.parse(CGI.unescapeHTML(page_json))
      user_props = page_data["props"]["user"]
      expect(user_props["totalCredits"]).to eq(7000.0)
      expect(user_props["planCredits"]).to eq(5000.0)
      expect(user_props["packCredits"]).to eq(2000.0)
    end
  end

  describe "GET /admin/users/:user_id/credit_gifts.json" do
    it "returns paginated gift history" do
      Array.new(3) do |i|
        CreditGift.create!(
          account: target_user.owned_account,
          admin: admin,
          amount: (i + 1) * 100,
          reason: "customer_support",
          notes: "Gift #{i + 1}"
        )
      end

      get madmin_user_credit_gifts_path(target_user, format: :json)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["gifts"].length).to eq(3)
      expect(body["pagination"]["current_page"]).to eq(1)
      expect(body["pagination"]["total_count"]).to eq(3)
    end

    it "returns gifts in reverse chronological order" do
      old_gift = CreditGift.create!(
        account: target_user.owned_account, admin: admin,
        amount: 100, reason: "customer_support", created_at: 2.days.ago
      )
      new_gift = CreditGift.create!(
        account: target_user.owned_account, admin: admin,
        amount: 200, reason: "promotional", created_at: 1.hour.ago
      )

      get madmin_user_credit_gifts_path(target_user, format: :json)

      body = JSON.parse(response.body)
      ids = body["gifts"].map { |g| g["id"] }
      expect(ids).to eq([new_gift.id, old_gift.id])
    end

    it "returns correct serialized fields" do
      gift = CreditGift.create!(
        account: target_user.owned_account, admin: admin,
        amount: 500, reason: "beta_testing", notes: "Test note"
      )

      get madmin_user_credit_gifts_path(target_user, format: :json)

      body = JSON.parse(response.body)
      g = body["gifts"].first
      expect(g["id"]).to eq(gift.id)
      expect(g["amount"]).to eq(500)
      expect(g["reason"]).to eq("beta_testing")
      expect(g["notes"]).to eq("Test note")
      expect(g["credits_allocated"]).to eq(false)
      expect(g["admin_name"]).to eq(admin.name)
      expect(g["created_at"]).to be_present
    end

    it "scopes gifts to the user's owned account" do
      other_user = create(:user)
      subscribe_account(other_user.owned_account, plan_name: "growth_monthly")

      CreditGift.create!(
        account: target_user.owned_account, admin: admin,
        amount: 100, reason: "customer_support"
      )
      CreditGift.create!(
        account: other_user.owned_account, admin: admin,
        amount: 200, reason: "customer_support"
      )

      get madmin_user_credit_gifts_path(target_user, format: :json)

      body = JSON.parse(response.body)
      expect(body["gifts"].length).to eq(1)
      expect(body["gifts"].first["amount"]).to eq(100)
    end

    it "paginates results" do
      12.times do |i|
        CreditGift.create!(
          account: target_user.owned_account, admin: admin,
          amount: (i + 1) * 10, reason: "customer_support"
        )
      end

      get madmin_user_credit_gifts_path(target_user, format: :json, page: 1)

      body = JSON.parse(response.body)
      expect(body["gifts"].length).to eq(10)
      expect(body["pagination"]["total_pages"]).to eq(2)
      expect(body["pagination"]["next_page"]).to eq(2)
      expect(body["pagination"]["prev_page"]).to be_nil

      get madmin_user_credit_gifts_path(target_user, format: :json, page: 2)

      body = JSON.parse(response.body)
      expect(body["gifts"].length).to eq(2)
      expect(body["pagination"]["prev_page"]).to eq(1)
      expect(body["pagination"]["next_page"]).to be_nil
    end

    context "when not authenticated as admin" do
      before { sign_in target_user }

      it "does not return gifts" do
        get madmin_user_credit_gifts_path(target_user, format: :json)

        expect(response).not_to have_http_status(:ok)
      end
    end
  end

  describe "POST /admin/users/:id/credit_gifts" do
    let(:gift_params) do
      {
        credit_gift: {
          amount: 500,
          reason: "customer_support",
          notes: "Test gift"
        }
      }
    end

    it "creates a credit gift for the user's owned account" do
      expect {
        post madmin_user_credit_gifts_path(target_user), params: gift_params
      }.to change(CreditGift, :count).by(1)
    end

    it "associates the gift with the user's owned account" do
      post madmin_user_credit_gifts_path(target_user), params: gift_params

      gift = CreditGift.last
      expect(gift.account).to eq(target_user.owned_account)
      expect(gift.admin).to eq(admin)
      expect(gift.amount).to eq(500)
      expect(gift.reason).to eq("customer_support")
      expect(gift.notes).to eq("Test gift")
    end

    it "redirects back to the user show page" do
      post madmin_user_credit_gifts_path(target_user), params: gift_params

      expect(response).to redirect_to(madmin_user_path(target_user))
    end

    context "with invalid params" do
      let(:gift_params) do
        {
          credit_gift: {
            amount: -1,
            reason: "customer_support"
          }
        }
      end

      it "does not create a gift" do
        expect {
          post madmin_user_credit_gifts_path(target_user), params: gift_params
        }.not_to change(CreditGift, :count)
      end

      it "redirects back with an error" do
        post madmin_user_credit_gifts_path(target_user), params: gift_params

        expect(response).to redirect_to(madmin_user_path(target_user))
      end
    end

    context "when not authenticated as admin" do
      before { sign_in target_user }

      it "does not create a gift" do
        expect {
          post madmin_user_credit_gifts_path(target_user), params: gift_params
        }.not_to change(CreditGift, :count)
      end
    end
  end
end
