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

    def self.edit_params_schema
      {
        type: :object,
        properties: {
          path: {type: :string, description: 'File path within the website'},
          old_string: {type: :string, description: 'String to find and replace'},
          new_string: {type: :string, description: 'Replacement string'},
          replace_all: {type: :boolean, description: 'Replace all occurrences (default: false)', default: false}
        },
        required: ['path', 'old_string', 'new_string']
      }
    end

    def self.edit_response
      {
        type: :object,
        properties: {
          file: file_object,
          occurrences: {type: :integer, description: 'Number of replacements made'}
        },
        required: ['file', 'occurrences']
      }
    end
  end
end
