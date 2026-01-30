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
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  user_id            :bigint           not null
#
# Indexes
#
#  index_support_requests_on_account_id  (account_id)
#  index_support_requests_on_user_id     (user_id)
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
    it { is_expected.to validate_length_of(:subject).is_at_least(5).is_at_most(200) }
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_length_of(:description).is_at_least(20).is_at_most(5000) }
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
    it "returns a formatted ticket reference" do
      support_request = create(:support_request)
      expect(support_request.ticket_reference).to match(/\ASR-\d{6}\z/)
    end

    it "zero-pads the ID" do
      support_request = create(:support_request)
      expected = "SR-#{support_request.id.to_s.rjust(6, "0")}"
      expect(support_request.ticket_reference).to eq(expected)
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
