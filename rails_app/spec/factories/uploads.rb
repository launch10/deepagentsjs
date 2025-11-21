# == Schema Information
#
# Table name: uploads
#
#  id                :bigint           not null, primary key
#  file              :string           not null
#  is_logo           :boolean          default(FALSE), not null
#  media_type        :string           not null
#  original_filename :string
#  uuid              :uuid             not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#
# Indexes
#
#  index_uploads_on_account_id  (account_id)
#  index_uploads_on_created_at  (created_at)
#  index_uploads_on_is_logo     (is_logo)
#  index_uploads_on_media_type  (media_type)
#  index_uploads_on_uuid        (uuid) UNIQUE
#

FactoryBot.define do
  factory :upload do
    account
    file { Rack::Test::UploadedFile.new(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
    is_logo { false }
  end
end
