# == Schema Information
#
# Table name: uploads
#
#  id         :bigint           not null, primary key
#  file       :string           not null
#  media_type :string           not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_uploads_on_account_id  (account_id)
#  index_uploads_on_created_at  (created_at)
#  index_uploads_on_media_type  (media_type)
#  index_uploads_on_uuid        (uuid) UNIQUE
#
class Upload < ApplicationRecord
  MEDIA_TYPES = %w[image video]

  belongs_to :account

  mount_uploader :file, MediaUploader

  has_many :website_uploads, dependent: :destroy
  has_many :websites, through: :website_uploads

  validates :file, presence: true
  validates :media_type, presence: true, inclusion: { in: MEDIA_TYPES }

  before_validation :set_media_type_from_file

  private

  def set_media_type_from_file
    return unless file.present? && file.file.present?

    content_type = file.file.content_type
    self.media_type = if content_type.start_with?("image/")
      "image"
    elsif content_type.start_with?("video/")
      "video"
    end
  end
end
