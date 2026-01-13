# frozen_string_literal: true

module APISchemas
  module Context
    def self.brainstorm_context
      {
        type: :object,
        nullable: true,
        properties: {
          id: APISchemas.id_field,
          idea: {type: :string, nullable: true, description: 'The core idea for the landing page'},
          audience: {type: :string, nullable: true, description: 'Target audience for the landing page'},
          solution: {type: :string, nullable: true, description: 'The solution being offered'},
          social_proof: {type: :string, nullable: true, description: 'Social proof elements'},
          look_and_feel: {type: :string, nullable: true, description: 'Design preferences'}
        },
        required: ['id']
      }
    end

    def self.theme_context
      {
        type: :object,
        nullable: true,
        properties: {
          id: APISchemas.id_field,
          name: {type: :string, description: 'Theme name'},
          colors: {type: :array, items: {type: :string}, description: 'Theme color palette'},
          typography_recommendations: {
            type: :object,
            additionalProperties: APISchemas::Theme.typography_category,
            nullable: true,
            description: 'Typography recommendations per background color'
          }
        },
        required: ['id', 'name', 'colors']
      }
    end

    def self.response
      {
        type: :object,
        properties: {
          brainstorm: brainstorm_context,
          uploads: APISchemas::Upload.collection_response,
          theme: theme_context
        },
        required: ['uploads']
      }
    end
  end
end
