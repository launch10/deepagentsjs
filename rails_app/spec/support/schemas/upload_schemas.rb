# frozen_string_literal: true

module APISchemas
  module Upload
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          uuid: {type: :string, description: 'Upload UUID'},
          url: {type: :string, description: 'Full size file URL'},
          thumb_url: {type: :string, nullable: true, description: 'Thumbnail URL (images only)'},
          medium_url: {type: :string, nullable: true, description: 'Medium size URL (images only)'},
          media_type: {type: :string, enum: ['image', 'video'], description: 'Media type'},
          is_logo: {type: :boolean, description: 'Whether this upload is a logo'},
          filename: {type: :string, description: 'Original filename'},
          created_at: {type: :string, format: 'date-time', description: 'Creation timestamp'},
          updated_at: {type: :string, format: 'date-time', description: 'Last update timestamp'}
        },
        required: ['id', 'uuid', 'url', 'media_type', 'is_logo', 'filename', 'created_at', 'updated_at']
      }
    end

    def self.collection_response
      {
        type: :array,
        items: response
      }
    end
  end
end
