module UploadConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_json
      {
        id: id,
        uuid: uuid,
        url: file.url,
        thumb_url: image? ? file.thumb.url : nil,
        medium_url: image? ? file.medium.url : nil,
        media_type: media_type,
        is_logo: is_logo,
        filename: original_filename,
        created_at: created_at,
        updated_at: updated_at
      }
    end
  end
end
