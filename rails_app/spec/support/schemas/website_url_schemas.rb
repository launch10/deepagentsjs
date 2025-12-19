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
  end
end
