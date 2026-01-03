# frozen_string_literal: true

module APISchemas
  module Website
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          name: {type: :string, nullable: true, description: 'Website name'},
          theme_id: {type: :integer, nullable: true, description: 'Theme ID'}
        },
        required: %w[id]
      }
    end

    def self.update_params_schema
      {
        type: :object,
        properties: {
          website: {
            type: :object,
            properties: {
              theme_id: {
                type: :integer,
                nullable: true,
                description: 'Theme ID to set for the website'
              }
            }
          }
        },
        required: ['website']
      }
    end
  end
end
