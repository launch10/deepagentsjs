# frozen_string_literal: true

module APISchemas
  module SocialLink
    PLATFORMS = %w[twitter instagram facebook linkedin youtube tiktok website other].freeze

    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          platform: {
            type: :string,
            enum: PLATFORMS,
            description: 'Social platform type'
          },
          url: {type: :string, nullable: true, description: 'URL to the social profile'},
          handle: {type: :string, nullable: true, description: 'Social handle/username'},
          project_id: APISchemas.id_field,
          **APISchemas.timestamps
        },
        required: %w[id platform project_id created_at updated_at]
      }
    end

    def self.list_response
      {
        type: :array,
        items: response
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          social_link: {
            type: :object,
            properties: {
              platform: {
                type: :string,
                enum: PLATFORMS,
                description: 'Social platform type'
              },
              url: {
                type: :string,
                description: 'URL to the social profile'
              },
              handle: {
                type: :string,
                description: 'Social handle/username'
              }
            },
            required: ['platform']
          }
        },
        required: ['social_link']
      }
    end

    def self.bulk_upsert_params_schema
      {
        type: :object,
        properties: {
          social_links: {
            type: :array,
            items: {
              type: :object,
              properties: {
                platform: {
                  type: :string,
                  enum: PLATFORMS,
                  description: 'Social platform type'
                },
                url: {
                  type: :string,
                  description: 'URL to the social profile'
                },
                handle: {
                  type: :string,
                  description: 'Social handle/username'
                }
              },
              required: ['platform']
            }
          }
        },
        required: ['social_links']
      }
    end

    def self.bulk_upsert_response
      {
        type: :array,
        items: response
      }
    end

    def self.bulk_upsert_error_response
      {
        type: :object,
        properties: {
          errors: {
            type: :array,
            items: {type: :string},
            description: 'Validation error messages (transaction rolls back all changes)'
          }
        },
        required: [:errors]
      }
    end
  end
end
