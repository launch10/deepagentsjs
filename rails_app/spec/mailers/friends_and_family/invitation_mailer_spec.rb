# frozen_string_literal: true

require "rails_helper"

RSpec.describe FriendsAndFamily::InvitationMailer, type: :mailer do
  describe "#invite" do
    let(:admin) { create(:user, :admin, first_name: "Brett", last_name: "Shollenberger") }
    let(:invited_user) { create(:user, email: "friend@example.com", first_name: "Test", last_name: "Friend") }
    let(:reset_token) { "abc123resettoken" }

    let(:mail) do
      described_class.with(
        admin: admin,
        user: invited_user,
        reset_token: reset_token,
        credits: 500
      ).invite
    end

    it "sends to the invited user's email" do
      expect(mail.to).to eq(["friend@example.com"])
    end

    it "includes the admin's name in the subject" do
      expect(mail.subject).to include("Brett Shollenberger")
    end

    it "includes the password reset link in the body" do
      expect(mail.body.encoded).to include(reset_token)
    end

    it "mentions the gifted credits" do
      expect(mail.body.encoded).to include("500")
    end

    it "includes a link to set up the account" do
      expect(mail.body.encoded).to include("reset_password_token=#{reset_token}")
    end

    context "with zero credits" do
      let(:mail) do
        described_class.with(
          admin: admin,
          user: invited_user,
          reset_token: reset_token,
          credits: 0
        ).invite
      end

      it "does not mention gifted credits" do
        expect(mail.body.encoded).not_to include("gifted")
      end
    end
  end
end
