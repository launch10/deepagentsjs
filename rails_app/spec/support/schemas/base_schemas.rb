# frozen_string_literal: true

module ApiSchemas
  # Common field types
  def self.id_field
    {type: :integer, description: 'Unique identifier'}
  end

  def self.timestamp_field
    {type: :string, format: 'date-time', description: 'Timestamp'}
  end

  def self.uuid_field
    {type: :string, format: 'uuid', description: 'UUID identifier'}
  end

  # Common timestamps
  def self.timestamps
    {
      created_at: timestamp_field,
      updated_at: timestamp_field
    }
  end

  # Common error response
  def self.error_response
    {
      type: :object,
      properties: {
        error: {type: :string, description: 'Error message'},
        errors: {
          type: :array,
          items: {type: :string},
          description: 'Array of error messages'
        }
      }
    }
  end

  # Success response with message
  def self.success_response
    {
      type: :object,
      properties: {
        status: {type: :string, example: 'ok'},
        message: {type: :string, example: 'Operation successful'}
      },
      required: ['status', 'message']
    }
  end
end