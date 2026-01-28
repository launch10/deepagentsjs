# frozen_string_literal: true

module InertiaSchemas
  module Auth
    # Auth pages have different shared props - no jwt/current_user since unauthenticated
    def self.shared_props
      {
        csrf_token: InertiaSchemas.string_field(description: 'CSRF token'),
        google_oauth_path: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Google OAuth path (null if OAuth disabled)')),
        flash: {
          type: :array,
          items: InertiaSchemas.flash_message_schema,
          description: 'Flash messages'
        }
      }
    end

    def self.required
      %w[csrf_token]
    end

    def self.with_props(page_props:, page_required: [])
      {
        type: :object,
        additionalProperties: false,
        properties: shared_props.merge(page_props),
        required: required + page_required
      }
    end
  end

  module SignIn
    def self.props_schema
      Auth.with_props(
        page_props: {
          errors: InertiaSchemas.nullable({
            type: :object,
            additionalProperties: { type: :array, items: { type: :string } }
          })
        }
      )
    end
  end

  module SignUp
    def self.props_schema
      Auth.with_props(
        page_props: {
          captcha_field_name: InertiaSchemas.string_field,
          minimum_password_length: InertiaSchemas.integer_field,
          spinner: InertiaSchemas.string_field,
          errors: InertiaSchemas.nullable({
            type: :object,
            additionalProperties: { type: :array, items: { type: :string } }
          })
        },
        page_required: %w[captcha_field_name minimum_password_length spinner]
      )
    end
  end
end
