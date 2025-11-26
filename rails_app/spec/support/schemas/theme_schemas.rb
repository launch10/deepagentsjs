# frozen_string_literal: true

module APISchemas
  module Theme
    def self.create_request
      {
        type: :object,
        properties: {
          theme: {
            type: :object,
            properties: {
              name: {type: :string, description: 'Theme name'},
              colors: {type: :array, items: {type: :string}, description: 'Theme color palette'}
            },
            required: ['name', 'colors']
          }
        },
        required: ['theme']
      }
    end

    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          name: {type: :string, description: 'Theme name'},
          colors: {type: :array, items: {type: :string}, description: 'Theme color palette'},
          theme_labels: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: APISchemas.id_field,
                name: {type: :string, description: 'Label name'}
              },
              required: ['id', 'name']
            },
            description: 'Associated theme labels'
          }
        },
        required: ['id', 'name', 'colors', 'theme_labels']
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
