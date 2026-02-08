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
  include TracksAgentContext

  belongs_to :website
  belongs_to :upload

  tracks_agent_context_on_create "images.created",
    payload: ->(wu) {
      {
        upload_id: wu.upload.id,
        filename: wu.upload.original_filename,
        url: wu.upload.file&.url
      }
    },
    if: ->(wu) { wu.upload.image? }

  tracks_agent_context_on_destroy "images.deleted",
    payload: ->(wu) {
      {
        upload_id: wu.upload.id,
        filename: wu.upload.original_filename
      }
    },
    if: ->(wu) { wu.upload.image? }
end
