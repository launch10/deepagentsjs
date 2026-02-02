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
#  ticket_id          :string           not null
#  user_id            :bigint           not null
#
# Indexes
#
#  index_support_requests_on_account_id  (account_id)
#  index_support_requests_on_ticket_id   (ticket_id) UNIQUE
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

  MAX_REQUESTS_PER_HOUR = 5

  validate :validate_attachments
  validate :validate_rate_limit, on: :create

  before_create :generate_ticket_id
  after_create :fire_support_workers

  def ticket_reference
    "SR-#{ticket_id}"
  end

  private

  def generate_ticket_id
    loop do
      self.ticket_id = SecureRandom.alphanumeric(8).upcase
      break unless SupportRequest.exists?(ticket_id: ticket_id)
    end
  end

  def validate_rate_limit
    return unless user

    if user.support_requests.where("created_at > ?", 1.hour.ago).count >= MAX_REQUESTS_PER_HOUR
      errors.add(:base, "You've submitted too many requests recently. Please try again later.")
    end
  end

  def fire_support_workers
    SupportMailer.support_request(self).deliver_later
    Support::SlackNotificationWorker.perform_async(id)
    Support::NotionCreationWorker.perform_async(id)
  end

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
