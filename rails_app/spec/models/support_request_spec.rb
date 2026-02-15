# frozen_string_literal: true

# == Schema Information
#
# Table name: support_requests
#
#  id                 :bigint           not null, primary key
#  browser_info       :text
#  category           :string           not null
#  credits_remaining  :integer
#  description        :text             not null
#  notion_created     :boolean          default(FALSE)
#  slack_notified     :boolean          default(FALSE)
#  subject            :string           not null
#  submitted_from_url :string
#  subscription_tier  :string
#  supportable_type   :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  supportable_id     :bigint
#  ticket_id          :string           not null
#  user_id            :bigint           not null
#
# Indexes
#
#  index_support_requests_on_account_id   (account_id)
#  index_support_requests_on_supportable  (supportable_type,supportable_id)
#  index_support_requests_on_ticket_id    (ticket_id) UNIQUE
#  index_support_requests_on_user_id      (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (user_id => users.id)
#
require "rails_helper"

RSpec.describe SupportRequest, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:account) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:category) }
    it { is_expected.to validate_inclusion_of(:category).in_array(SupportRequest::CATEGORIES) }
    it { is_expected.to validate_presence_of(:subject) }
    it { is_expected.to validate_length_of(:subject).is_at_most(200) }
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_length_of(:description).is_at_most(5000) }
  end

  describe "CATEGORIES" do
    it "includes expected categories" do
      expect(SupportRequest::CATEGORIES).to contain_exactly(
        "Report a bug",
        "Billing question",
        "How do I...?",
        "Feature request",
        "Other"
      )
    end
  end

  describe "#ticket_reference" do
    it "returns a formatted ticket reference with alphanumeric ticket_id" do
      support_request = create(:support_request)
      expect(support_request.ticket_reference).to match(/\ASR-[A-Z0-9]{8}\z/)
    end

    it "uses the ticket_id column" do
      support_request = create(:support_request)
      expect(support_request.ticket_reference).to eq("SR-#{support_request.ticket_id}")
    end
  end

  describe "#generate_ticket_id" do
    it "auto-generates a unique ticket_id on create" do
      support_request = create(:support_request)
      expect(support_request.ticket_id).to be_present
      expect(support_request.ticket_id).to match(/\A[A-Z0-9]{8}\z/)
    end

    it "generates unique ticket_ids" do
      ids = 5.times.map { create(:support_request).ticket_id }
      expect(ids.uniq.length).to eq(5)
    end
  end

  describe "attachment validations" do
    let(:support_request) { create(:support_request) }

    it "rejects more than 3 attachments" do
      4.times do |i|
        support_request.attachments.attach(
          io: StringIO.new("data"),
          filename: "file#{i}.png",
          content_type: "image/png"
        )
      end

      expect(support_request).not_to be_valid
      expect(support_request.errors[:attachments]).to include("can have at most 3 files")
    end

    it "rejects disallowed content types" do
      support_request.attachments.attach(
        io: StringIO.new("data"),
        filename: "script.js",
        content_type: "application/javascript"
      )

      expect(support_request).not_to be_valid
      expect(support_request.errors[:attachments]).to include("must be images (PNG, JPEG, GIF, WebP) or PDFs")
    end

    it "rejects files over 10MB" do
      support_request.attachments.attach(
        io: StringIO.new("x" * (11 * 1024 * 1024)),
        filename: "large.png",
        content_type: "image/png"
      )

      expect(support_request).not_to be_valid
      expect(support_request.errors[:attachments]).to include("must be under 10MB each")
    end

    it "accepts valid attachments" do
      support_request.attachments.attach(
        io: StringIO.new("valid image data"),
        filename: "screenshot.png",
        content_type: "image/png"
      )

      expect(support_request).to be_valid
    end
  end

  describe "factory" do
    it "creates a valid support request" do
      support_request = create(:support_request)
      expect(support_request).to be_valid
    end
  end
end
