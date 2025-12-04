# frozen_string_literal: true

module APISchemas
  module WebsiteFile
    def self.file_object
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          website_id: APISchemas.id_field,
          path: {type: :string, description: 'File path within the website'},
          content: {type: :string, description: 'File content'},
          **APISchemas.timestamps
        },
        required: ['id', 'website_id', 'path', 'content', 'created_at', 'updated_at']
      }
    end

    def self.write_response
      {
        type: :object,
        properties: {
          files: {
            type: :array,
            items: file_object,
            description: 'Array of created/updated files'
          }
        },
        required: ['files']
      }
    end

    def self.write_params_schema
      {
        type: :object,
        properties: {
          files: {
            type: :array,
            items: {
              type: :object,
              properties: {
                path: {type: :string, description: 'File path within the website'},
                content: {type: :string, description: 'File content'}
              },
              required: ['path', 'content']
            },
            description: 'Array of files to create or update'
          }
        },
        required: ['files']
      }
    end
  end
end
