# frozen_string_literal: true

module APISchemas
  module Lead
    # Lead creation success response schema
    # Returns minimal JSON to confirm success - no PII echoed back
    def self.success_response
      {
        type: :object,
        properties: {
          success: {
            type: :boolean,
            description: 'Indicates the lead was successfully created or updated'
          }
        },
        required: ['success']
      }
    end

    # Lead creation error response - validation errors
    def self.validation_error_response
      {
        type: :object,
        properties: {
          errors: {
            type: :object,
            additionalProperties: {
              type: :array,
              items: { type: :string }
            },
            description: 'Validation error messages keyed by field name'
          }
        },
        required: ['errors']
      }
    end

    # Lead creation error response - authentication failure
    def self.auth_error_response
      {
        type: :object,
        properties: {
          error: {
            type: :string,
            description: 'Authentication error message (e.g., "Invalid token")'
          }
        },
        required: ['error']
      }
    end

    # Lead creation params schema
    # Token is passed as query parameter, lead data in body
    def self.params_schema
      {
        type: :object,
        properties: {
          email: {
            type: :string,
            format: 'email',
            maxLength: 255,
            description: 'Email address for the lead signup (required)'
          },
          name: {
            type: :string,
            maxLength: 255,
            nullable: true,
            description: 'Optional name of the person signing up'
          },
          phone: {
            type: :string,
            maxLength: 50,
            nullable: true,
            description: 'Optional phone number of the person signing up'
          }
        },
        required: ['email']
      }
    end

    # Token parameter schema (passed as query param)
    def self.token_schema
      {
        type: :string,
        description: <<~DESC.strip
          Signed ID token that authenticates the request and identifies the project.
          Generated via Project#signed_id(purpose: :lead_signup).
          This token is embedded in deployed landing pages at build time.
        DESC
      }
    end
  end
end
