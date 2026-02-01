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
          website_name: {type: :string, nullable: true, description: 'Associated website name'},
          is_platform_subdomain: {type: :boolean, description: 'Whether this is a platform subdomain'},
          cloudflare_zone_id: {type: :string, nullable: true, description: 'Cloudflare zone ID'},
          website_urls: {
            type: :array,
            nullable: true,
            items: {
              type: :object,
              properties: {
                id: APISchemas.id_field,
                path: {type: :string, description: 'URL path'},
                website_id: {type: :integer, description: 'Website ID'}
              },
              required: ['id', 'path', 'website_id']
            },
            description: 'URLs associated with this domain (only included when include_website_urls=true)'
          },
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
          },
          platform_subdomain_credits: {
            type: :object,
            properties: {
              limit: {type: :integer, description: 'Maximum platform subdomains allowed'},
              used: {type: :integer, description: 'Number of platform subdomains used'},
              remaining: {type: :integer, description: 'Remaining platform subdomains'}
            },
            required: ['limit', 'used', 'remaining']
          },
          plan_tier: {type: :string, nullable: true, description: 'User plan tier (starter, growth, pro)'}
        },
        required: ['domains', 'platform_subdomain_credits']
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

    def self.search_params_schema
      {
        type: :object,
        properties: {
          candidates: {
            type: :array,
            items: {type: :string},
            description: 'Array of domain names to check availability (max 10)'
          }
        },
        required: ['candidates']
      }
    end

    def self.search_response
      {
        type: :object,
        properties: {
          results: {
            type: :array,
            items: {
              type: :object,
              properties: {
                domain: {type: :string, description: 'Domain name'},
                status: {type: :string, enum: ['existing', 'unavailable', 'available'], description: 'Availability status'},
                existing_id: {type: :integer, nullable: true, description: 'ID of existing domain if owned by current account'}
              },
              required: ['domain', 'status']
            }
          },
          platform_subdomain_credits: {
            type: :object,
            properties: {
              limit: {type: :integer, description: 'Maximum platform subdomains allowed'},
              used: {type: :integer, description: 'Number of platform subdomains used'},
              remaining: {type: :integer, description: 'Remaining platform subdomains'}
            },
            required: ['limit', 'used', 'remaining']
          }
        },
        required: ['results', 'platform_subdomain_credits']
      }
    end

    def self.verify_dns_response
      {
        type: :object,
        properties: {
          domain_id: APISchemas.id_field,
          domain: {type: :string, description: 'Domain name'},
          verification_status: {
            type: :string,
            enum: ['pending', 'verified', 'failed'],
            description: 'DNS verification status'
          },
          expected_cname: {type: :string, nullable: true, description: 'Expected CNAME target'},
          actual_cname: {type: :string, nullable: true, description: 'Actual CNAME found'},
          last_checked_at: {type: :string, format: 'date-time', nullable: true, description: 'Last DNS check timestamp'},
          error_message: {type: :string, nullable: true, description: 'Error message if verification failed'}
        },
        required: ['domain_id', 'domain', 'verification_status']
      }
    end
  end
end
