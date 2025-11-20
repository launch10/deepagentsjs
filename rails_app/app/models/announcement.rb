# == Schema Information
#
# Table name: announcements
#
#  id           :bigint           not null, primary key
#  kind         :string
#  published_at :datetime
#  title        :string
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#

class Announcement < ApplicationRecord
  TYPES = %w[new fix improvement update]

  scope :draft, -> { where(published_at: nil) }
  scope :published, -> { where.not(published_at: nil) }

  has_rich_text :description

  validates :kind, :title, :description, presence: true

  attribute :published_at, default: -> { Time.current }

  def self.unread?(user)
    most_recent_announcement = published.maximum(:published_at)
    most_recent_announcement && (user.nil? || user.announcements_read_at&.before?(most_recent_announcement))
  end
end
