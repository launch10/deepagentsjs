# == Schema Information
#
# Table name: website_uploads
#
#  id         :bigint           not null, primary key
#  upload_id  :bigint           not null
#  website_id :bigint           not null
#
# Indexes
#
#  index_website_uploads_on_upload_id   (upload_id)
#  index_website_uploads_on_website_id  (website_id)
#
class WebsiteUpload < ApplicationRecord
  belongs_to :website
  belongs_to :upload
end
