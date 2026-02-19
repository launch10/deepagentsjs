# frozen_string_literal: true

require "rails_helper"

RSpec.describe FriendsAndFamily::InviteService do
  include Devise::Test::IntegrationHelpers

  let(:admin) { create(:user, :admin) }

  before do
    ensure_plans_exist
    subscribe_account(admin.owned_account, plan_name: "growth_monthly")
  end

  describe "#call" do
    let(:params) { {email: "friend@example.com", name: "Test Friend", credits: 500} }

    subject { described_class.new(admin: admin).call(**params) }

    context "with a new email" do
      it "creates a new user" do
        expect { subject }.to change(User, :count).by(1)
      end

      it "sets the user's name and email" do
        result = subject
        user = result.user
        expect(user.email).to eq("friend@example.com")
        expect(user.name).to eq("Test Friend")
      end

      it "confirms the user" do
        result = subject
        expect(result.user.confirmed_at).to be_present
      end

      it "subscribes the account to the friends_family plan" do
        result = subject
        account = result.user.owned_account
        expect(account.plan.name).to eq("friends_family")
      end

      it "creates a credit gift" do
        expect { subject }.to change(CreditGift, :count).by(1)
      end

      it "creates the gift with correct attributes" do
        result = subject
        gift = CreditGift.last
        expect(gift.account).to eq(result.user.owned_account)
        expect(gift.admin).to eq(admin)
        expect(gift.amount).to eq(500)
        expect(gift.reason).to eq("beta_testing")
      end

      it "generates a password reset token" do
        result = subject
        expect(result.reset_token).to be_present
      end

      it "enqueues an invitation email" do
        expect { subject }.to have_enqueued_mail(FriendsAndFamily::InvitationMailer, :invite)
      end

      it "returns a successful result" do
        result = subject
        expect(result).to be_success
      end
    end

    context "with zero credits" do
      let(:params) { {email: "friend@example.com", name: "Test Friend", credits: 0} }

      it "creates the user and subscription without a credit gift" do
        expect { subject }.not_to change(CreditGift, :count)
      end

      it "still creates the user" do
        expect { subject }.to change(User, :count).by(1)
      end

      it "returns a successful result" do
        result = subject
        expect(result).to be_success
      end
    end

    context "when user already exists without a subscription" do
      let!(:existing_user) do
        user = create(:user, email: "friend@example.com")
        # Don't subscribe - simulate an abandoned signup
        user
      end

      it "does not create a new user" do
        expect { subject }.not_to change(User, :count)
      end

      it "subscribes the existing user's account" do
        subject
        account = existing_user.owned_account.reload
        expect(account.plan.name).to eq("friends_family")
      end

      it "creates a credit gift" do
        expect { subject }.to change(CreditGift, :count).by(1)
      end

      it "returns a successful result" do
        result = subject
        expect(result).to be_success
      end
    end

    context "when user already exists with a subscription" do
      let!(:existing_user) do
        user = create(:user, email: "friend@example.com")
        subscribe_account(user.owned_account, plan_name: "growth_monthly")
        user
      end

      it "returns an error result" do
        result = subject
        expect(result).not_to be_success
        expect(result.error).to include("already has a subscription")
      end

      it "does not create a credit gift" do
        expect { subject }.not_to change(CreditGift, :count)
      end
    end

    context "with invalid params" do
      it "returns an error for blank email" do
        result = described_class.new(admin: admin).call(email: "", name: "Friend", credits: 500)
        expect(result).not_to be_success
        expect(result.error).to include("Email")
      end

      it "returns an error for blank name" do
        result = described_class.new(admin: admin).call(email: "friend@example.com", name: "", credits: 500)
        expect(result).not_to be_success
        expect(result.error).to include("Name")
      end

      it "returns an error for negative credits" do
        result = described_class.new(admin: admin).call(email: "friend@example.com", name: "Friend", credits: -1)
        expect(result).not_to be_success
        expect(result.error).to include("Credits")
      end
    end
  end
end
