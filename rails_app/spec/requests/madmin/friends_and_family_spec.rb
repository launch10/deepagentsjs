# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Madmin::FriendsAndFamily", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:user, :admin) }

  before do
    ensure_plans_exist
    subscribe_account(admin.owned_account, plan_name: "growth_monthly")
    sign_in admin
  end

  describe "GET /admin/friends_and_family" do
    it "returns the index page" do
      get madmin_friends_and_family_index_path

      expect(response).to have_http_status(:ok)
    end

    it "lists F&F users" do
      # Create an F&F user
      ff_user = create(:user, email: "friend@example.com", first_name: "Test", last_name: "Friend")
      subscribe_account(ff_user.owned_account, plan_name: "friends_family")

      get madmin_friends_and_family_index_path

      expect(response).to have_http_status(:ok)
      page_json = response.body.match(/data-page="([^"]+)"/)[1]
      page_data = JSON.parse(CGI.unescapeHTML(page_json))
      users = page_data["props"]["users"]
      expect(users.length).to eq(1)
      expect(users.first["email"]).to eq("friend@example.com")
    end

    context "when not authenticated as admin" do
      before { sign_in create(:user) }

      it "redirects away" do
        get madmin_friends_and_family_index_path
        expect(response).not_to have_http_status(:ok)
      end
    end
  end

  describe "POST /admin/friends_and_family" do
    let(:invite_params) do
      {
        friends_and_family: {
          email: "newfriend@example.com",
          name: "New Friend",
          credits: 500
        }
      }
    end

    it "creates a new F&F user" do
      expect {
        post madmin_friends_and_family_index_path, params: invite_params
      }.to change(User, :count).by(1)
    end

    it "redirects back to the index" do
      post madmin_friends_and_family_index_path, params: invite_params
      expect(response).to redirect_to(madmin_friends_and_family_index_path)
    end

    it "sets a flash notice" do
      post madmin_friends_and_family_index_path, params: invite_params
      expect(flash[:notice]).to be_present
    end

    context "with invalid params" do
      let(:invite_params) do
        {
          friends_and_family: {
            email: "",
            name: "New Friend",
            credits: 500
          }
        }
      end

      it "does not create a user" do
        expect {
          post madmin_friends_and_family_index_path, params: invite_params
        }.not_to change(User, :count)
      end

      it "redirects with an error flash" do
        post madmin_friends_and_family_index_path, params: invite_params
        expect(flash[:alert]).to be_present
      end
    end

    context "when not authenticated as admin" do
      before { sign_in create(:user) }

      it "does not create a user" do
        expect {
          post madmin_friends_and_family_index_path, params: invite_params
        }.not_to change(User, :count)
      end
    end
  end

  describe "POST /admin/friends_and_family/:id/revoke" do
    let!(:ff_user) do
      user = create(:user, email: "friend@example.com", first_name: "Test", last_name: "Friend")
      subscribe_account(user.owned_account, plan_name: "friends_family")
      user
    end

    it "cancels the F&F subscription" do
      post revoke_madmin_friends_and_family_path(ff_user)

      ff_user.owned_account.reload
      expect(ff_user.owned_account.payment_processor.subscribed?).to be false
    end

    it "redirects back to the index with a notice" do
      post revoke_madmin_friends_and_family_path(ff_user)

      expect(response).to redirect_to(madmin_friends_and_family_index_path)
      expect(flash[:notice]).to include("revoked")
    end

    it "no longer lists the user on the index page" do
      post revoke_madmin_friends_and_family_path(ff_user)

      get madmin_friends_and_family_index_path
      page_json = response.body.match(/data-page="([^"]+)"/)[1]
      page_data = JSON.parse(CGI.unescapeHTML(page_json))
      users = page_data["props"]["users"]
      expect(users).to be_empty
    end

    context "when user has no active subscription" do
      before { unsubscribe_account(ff_user.owned_account) }

      it "redirects with an alert" do
        post revoke_madmin_friends_and_family_path(ff_user)

        expect(response).to redirect_to(madmin_friends_and_family_index_path)
        expect(flash[:alert]).to include("no active subscription")
      end
    end
  end

  describe "POST /admin/friends_and_family/:id/resend" do
    let!(:ff_user) do
      user = create(:user, email: "friend@example.com", first_name: "Test", last_name: "Friend")
      subscribe_account(user.owned_account, plan_name: "friends_family")
      user
    end

    it "enqueues a new invitation email" do
      expect {
        post resend_madmin_friends_and_family_path(ff_user)
      }.to have_enqueued_mail(FriendsAndFamily::InvitationMailer, :invite)
    end

    it "redirects back to the index" do
      post resend_madmin_friends_and_family_path(ff_user)
      expect(response).to redirect_to(madmin_friends_and_family_index_path)
    end

    it "sets a flash notice" do
      post resend_madmin_friends_and_family_path(ff_user)
      expect(flash[:notice]).to be_present
    end
  end
end
