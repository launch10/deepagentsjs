# frozen_string_literal: true

module ApiSchemas
  module Theme
    def self.response
      {
        type: :object,
        properties: {
          id: ApiSchemas.id_field,
          name: {type: :string, description: 'Theme name'},
          colors: {type: :object, description: 'Theme color palette'},
          theme: {type: :object, description: 'Theme configuration'},
          theme_labels: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: ApiSchemas.id_field,
                name: {type: :string, description: 'Label name'}
              }
            },
            description: 'Associated theme labels'
          },
          **ApiSchemas.timestamps
        },
        required: ['id', 'name', 'colors', 'theme', 'created_at', 'updated_at']
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
