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

    def self.typography_recommendation
      {
        type: :object,
        properties: {
          color: {type: :string, description: 'Hex color code'},
          contrast: {type: :number, description: 'Contrast ratio'},
          level: {type: :string, enum: ['AAA', 'AA', 'AA-large', 'fail'], description: 'WCAG compliance level'},
          style: {type: :string, description: 'Style hint'},
          note: {type: :string, nullable: true, description: 'Additional guidance'}
        },
        required: ['color', 'contrast', 'level', 'style']
      }
    end

    def self.typography_category
      {
        type: :object,
        properties: {
          headlines: {type: :array, items: typography_recommendation, description: 'Headline color options'},
          subheadlines: {type: :array, items: typography_recommendation, description: 'Subheadline color options'},
          body: {type: :array, items: typography_recommendation, description: 'Body text color options'},
          accents: {type: :array, items: typography_recommendation, description: 'Accent color options'}
        },
        required: ['headlines', 'subheadlines', 'body', 'accents']
      }
    end

    def self.full_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          name: {type: :string, description: 'Theme name'},
          colors: {type: :array, items: {type: :string}, description: 'Theme color palette'},
          theme: {type: :object, additionalProperties: {type: :string}, description: 'CSS theme variables (HSL values)'},
          pairings: {type: :object, additionalProperties: true, description: 'Color pairing recommendations'},
          typography_recommendations: {
            type: :object,
            additionalProperties: typography_category,
            nullable: true,
            description: 'Typography recommendations per background color'
          },
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
