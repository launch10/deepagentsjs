# frozen_string_literal: true

module InertiaSchemas
  def self.string_field(description: nil)
    { type: :string }.tap { |h| h[:description] = description if description }
  end

  def self.integer_field(description: nil)
    { type: :integer }.tap { |h| h[:description] = description if description }
  end

  def self.boolean_field(description: nil)
    { type: :boolean }.tap { |h| h[:description] = description if description }
  end

  def self.nullable(schema)
    schema.merge(nullable: true)
  end

  def self.always_null(description: nil)
    { type: :null }.tap { |h| h[:description] = description if description }
  end

  def self.flash_message_schema
    {
      type: :object,
      properties: {
        type: { type: :string, enum: %w[success error info] },
        message: { type: :string }
      },
      required: %w[type message]
    }
  end

  def self.user_schema
    {
      type: :object,
      properties: {
        id: integer_field,
        name: string_field,
        email: string_field
      },
      required: %w[id name email]
    }
  end

  def self.shared_props
    {
      root_path: { type: :string, description: 'Base URL of the application' },
      langgraph_path: { type: :string, description: 'URL of the Langgraph service' },
      jwt: { type: :string, description: 'JWT token for API authentication' },
      errors: {
        type: :object,
        additionalProperties: {
          type: :array,
          items: { type: :string }
        },
        description: 'Validation errors from session'
      },
      flash: {
        type: :array,
        items: flash_message_schema,
        description: 'Flash messages'
      },
      current_user: nullable(user_schema).merge(description: 'Currently authenticated user'),
      true_user: nullable(user_schema).merge(description: 'Original admin user when impersonating'),
      impersonating: boolean_field(description: 'Whether admin is currently impersonating another user')
    }
  end

  def self.shared_props_required
    %w[root_path langgraph_path jwt]
  end

  def self.with_shared_props(page_props:, page_required: [])
    {
      type: :object,
      additionalProperties: false,
      properties: shared_props.merge(page_props),
      required: shared_props_required + page_required
    }
  end
end
