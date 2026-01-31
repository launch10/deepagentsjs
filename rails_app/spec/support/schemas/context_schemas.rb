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

    def self.domain_with_website
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          domain: {type: :string, description: 'Domain name'},
          is_platform_subdomain: {type: :boolean, description: 'Whether this is a platform subdomain'},
          website_id: {type: :integer, nullable: true, description: 'Associated website ID'},
          website_name: {type: :string, nullable: true, description: 'Associated website name'},
          website_urls: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: APISchemas.id_field,
                path: {type: :string, description: 'URL path'},
                website_id: {type: :integer, description: 'Website ID'}
              },
              required: ['id', 'path', 'website_id']
            },
            description: 'URLs associated with this domain'
          },
          created_at: {type: :string, format: 'date-time', description: 'Creation timestamp'}
        },
        required: ['id', 'domain', 'is_platform_subdomain', 'created_at']
      }
    end

    def self.platform_subdomain_credits
      {
        type: :object,
        properties: {
          limit: {type: :integer, description: 'Maximum platform subdomains allowed'},
          used: {type: :integer, description: 'Number of platform subdomains used'},
          remaining: {type: :integer, description: 'Remaining platform subdomains'}
        },
        required: ['limit', 'used', 'remaining']
      }
    end

    def self.domain_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          domain: {type: :string, description: 'Domain name'},
          account_id: APISchemas.id_field,
          website_id: {type: :integer, nullable: true, description: 'Associated website ID'},
          is_platform_subdomain: {type: :boolean, description: 'Whether this is a platform subdomain'},
          cloudflare_zone_id: {type: :string, nullable: true, description: 'Cloudflare zone ID'},
          created_at: {type: :string, format: 'date-time', description: 'Timestamp'},
          updated_at: {type: :string, format: 'date-time', description: 'Timestamp'}
        },
        required: ['id', 'domain', 'account_id', 'is_platform_subdomain', 'created_at', 'updated_at']
      }
    end

    def self.domain_context_response
      {
        type: :object,
        properties: {
          existing_domains: {
            type: :array,
            items: domain_with_website,
            description: 'All domains belonging to the account'
          },
          platform_subdomain_credits: platform_subdomain_credits,
          brainstorm_context: {
            type: :object,
            nullable: true,
            properties: {
              id: APISchemas.id_field,
              idea: {type: :string, nullable: true, description: 'The core idea for the landing page'},
              audience: {type: :string, nullable: true, description: 'Target audience for the landing page'},
              solution: {type: :string, nullable: true, description: 'The solution being offered'},
              social_proof: {type: :string, nullable: true, description: 'Social proof elements'}
            },
            required: ['id']
          }
        },
        required: ['existing_domains', 'platform_subdomain_credits']
      }
    end
  end
end
