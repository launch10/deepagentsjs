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
require 'rails_helper'

RSpec.describe Upload, type: :model do
  it "rejects invalid media types" do
    upload = Upload.new(media_type: "invalid")
    expect(upload).to_not be_valid
  end
  it "automatically sets image type" do
    upload = Upload.create(
      file: fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg'),
      account: create(:account)
    )
    expect(upload.media_type).to eq("image")
  end

  it "automatically sets video type" do
    upload = Upload.create(
      file: fixture_file_upload(Rails.root.join('spec/fixtures/files/test_video.mp4'), 'video/mp4'),
      account: create(:account)
    )
    expect(upload.media_type).to eq("video")
  end

  it "rejects non-image and non-video files" do
    upload = Upload.create(
      file: fixture_file_upload(Rails.root.join('spec/fixtures/files/test_document.pdf'), 'application/pdf'),
      account: create(:account)
    )
    expect(upload).to_not be_valid
  end
end
