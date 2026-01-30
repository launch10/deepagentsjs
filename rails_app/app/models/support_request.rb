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
class SupportRequest < ApplicationRecord
  belongs_to :user
  belongs_to :account

  has_many_attached :attachments

  CATEGORIES = [
    "Report a bug",
    "Billing question",
    "How do I...?",
    "Feature request",
    "Other"
  ].freeze

  validates :category, presence: true, inclusion: {in: CATEGORIES}
  validates :subject, presence: true, length: {maximum: 200}
  validates :description, presence: true, length: {maximum: 5000}

  validate :validate_attachments

  def ticket_reference
    "SR-#{id.to_s.rjust(6, "0")}"
  end

  private

  def validate_attachments
    return unless attachments.attached?

    if attachments.count > 3
      errors.add(:attachments, "can have at most 3 files")
    end

    attachments.each do |attachment|
      unless attachment.content_type.in?(%w[image/png image/jpeg image/gif image/webp application/pdf])
        errors.add(:attachments, "must be images (PNG, JPEG, GIF, WebP) or PDFs")
      end

      if attachment.byte_size > 10.megabytes
        errors.add(:attachments, "must be under 10MB each")
      end
    end
  end
end
