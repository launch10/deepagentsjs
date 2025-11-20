
module UploadConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_json
      {
        id: id,
        uuid: uuid,
        url: file.url,
        media_type: media_type,
        is_logo: is_logo,
        created_at: created_at,
        updated_at: updated_at
      }
    end
  end
end
