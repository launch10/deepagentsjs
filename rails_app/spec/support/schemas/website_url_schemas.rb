# frozen_string_literal: true

module APISchemas
  module WebsiteUrl
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          path: {type: :string, description: 'URL path'},
          account_id: APISchemas.id_field,
          website_id: APISchemas.id_field,
          domain_id: APISchemas.id_field,
          domain_string: {type: :string, nullable: true, description: 'Domain name'},
          **APISchemas.timestamps
        },
        required: [
          'id',
          'path',
          'account_id',
          'website_id',
          'domain_id',
          'created_at',
          'updated_at'
        ]
      }
    end

    def self.list_response
      {
        type: :object,
        properties: {
          website_urls: {
            type: :array,
            items: response
          }
        },
        required: ['website_urls']
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          website_url: {
            type: :object,
            properties: {
              path: {
                type: :string,
                description: 'URL path'
              },
              website_id: {
                type: :integer,
                description: 'Associated website ID'
              },
              domain_id: {
                type: :integer,
                description: 'Associated domain ID'
              }
            },
            required: ['domain_id', 'website_id', 'path']
          }
        },
        required: ['website_url']
      }
    end

    def self.search_params_schema
      {
        type: :object,
        properties: {
          domain_id: {
            type: :integer,
            description: 'Domain ID to search within'
          },
          candidates: {
            type: :array,
            items: {type: :string},
            description: 'Array of paths to check availability (max 10)'
          }
        },
        required: ['domain_id', 'candidates']
      }
    end

    def self.search_response
      {
        type: :object,
        properties: {
          domain_id: APISchemas.id_field,
          domain: {type: :string, description: 'Domain name'},
          results: {
            type: :array,
            items: {
              type: :object,
              properties: {
                path: {type: :string, description: 'URL path'},
                status: {type: :string, enum: ['existing', 'unavailable', 'available'], description: 'Availability status'},
                existing_id: {type: :integer, nullable: true, description: 'ID of existing website URL if owned by current account'},
                existing_website_id: {type: :integer, nullable: true, description: 'Website ID of existing URL if owned by current account'}
              },
              required: ['path', 'status']
            }
          }
        },
        required: ['domain_id', 'domain', 'results']
      }
    end
  end
end
