# frozen_string_literal: true

module ApiSchemas
  module Database
    # Snapshot list response
    def self.snapshots_response
      {
        type: :object,
        properties: {
          snapshots: {
            type: :array,
            items: {type: :string},
            description: 'Array of snapshot names (without .sql extension)'
          }
        },
        required: ['snapshots']
      }
    end

    # Snapshot params
    def self.snapshot_params
      {
        type: :object,
        properties: {
          snapshot: {
            type: :object,
            properties: {
              name: {
                type: :string,
                description: 'Name for the snapshot (without .sql extension)'
              },
              truncate_first: {
                type: :boolean,
                description: 'Whether to truncate the database before restoring',
                default: false
              }
            },
            required: ['name']
          }
        },
        required: ['snapshot']
      }
    end

    # Success response for database operations
    def self.operation_response
      {
        type: :object,
        properties: {
          status: {type: :string, example: 'ok'},
          message: {type: :string, example: "Operation completed successfully"}
        },
        required: ['status', 'message']
      }
    end

    # Error response for database operations
    def self.error_response
      {
        type: :object,
        properties: {
          status: {type: :string, example: 'error'},
          message: {type: :string, example: 'Failed to perform operation: error details'}
        },
        required: ['status', 'message']
      }
    end
  end
end
