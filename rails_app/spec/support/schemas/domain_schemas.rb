# frozen_string_literal: true

module APISchemas
  module Domain
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          domain: {type: :string, description: 'Domain name'},
          account_id: APISchemas.id_field,
          website_id: {type: :integer, nullable: true, description: 'Associated website ID'},
          is_platform_subdomain: {type: :boolean, description: 'Whether this is a platform subdomain'},
          cloudflare_zone_id: {type: :string, nullable: true, description: 'Cloudflare zone ID'},
          **APISchemas.timestamps
        },
        required: [
          'id',
          'domain',
          'account_id',
          'is_platform_subdomain',
          'created_at',
          'updated_at'
        ]
      }
    end

    def self.list_response
      {
        type: :object,
        properties: {
          domains: {
            type: :array,
            items: response
          }
        },
        required: ['domains']
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          domain: {
            type: :object,
            properties: {
              domain: {
                type: :string,
                description: 'Domain name'
              },
              website_id: {
                type: :integer,
                description: 'Associated website ID'
              },
              is_platform_subdomain: {
                type: :boolean,
                description: 'Whether this is a platform subdomain'
              }
            }
          }
        },
        required: ['domain']
      }
    end
  end
end
