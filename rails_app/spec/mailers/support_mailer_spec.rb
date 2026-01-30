# frozen_string_literal: true

require "rails_helper"

RSpec.describe SupportMailer, type: :mailer do
  describe "#support_request" do
    let(:support_request) { create(:support_request) }
    let(:mail) { described_class.support_request(support_request) }

    it "sends to support@launch10.ai" do
      expect(mail.to).to eq(["support@launch10.ai"])
    end

    it "sets the subject with category" do
      expect(mail.subject).to eq("[Report a bug] Something is broken")
    end

    it "sets reply-to as the user's email" do
      expect(mail.reply_to).to eq([support_request.user.email])
    end

    it "includes the ticket reference in the body" do
      expect(mail.body.encoded).to include(support_request.ticket_reference)
    end

    it "includes the description in the body" do
      expect(mail.body.encoded).to include(support_request.description)
    end

    it "includes user email in the body" do
      expect(mail.body.encoded).to include(support_request.user.email)
    end

    context "with attachments" do
      let(:support_request) do
        sr = create(:support_request)
        sr.attachments.attach(
          io: StringIO.new("fake image data"),
          filename: "screenshot.png",
          content_type: "image/png"
        )
        sr
      end

      it "includes the attachment in the email" do
        expect(mail.attachments.count).to eq(1)
        expect(mail.attachments.first.filename).to eq("screenshot.png")
      end
    end
  end
end
