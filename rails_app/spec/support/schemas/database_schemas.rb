# frozen_string_literal: true

module APISchemas
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
          errors: {type: :array, items: {type: :string, example: 'Failed to perform operation: error details'}}
        },
        required: ['status', 'errors']
      }
    end

    # Credits params for set_credits endpoint
    def self.credits_params
      {
        type: :object,
        properties: {
          credits: {
            type: :object,
            properties: {
              email: {
                type: :string,
                description: 'Email of the user whose account credits to set'
              },
              plan_millicredits: {
                type: :integer,
                description: 'Plan millicredits to set',
                default: 0
              },
              pack_millicredits: {
                type: :integer,
                description: 'Pack millicredits to set',
                default: 0
              }
            },
            required: ['email']
          }
        },
        required: ['credits']
      }
    end

    # Success response for set_credits
    def self.credits_response
      {
        type: :object,
        properties: {
          status: {type: :string, example: 'ok'},
          message: {type: :string, example: 'Credits updated'},
          account: {
            type: :object,
            properties: {
              id: {type: :integer},
              plan_millicredits: {type: :integer},
              pack_millicredits: {type: :integer},
              total_millicredits: {type: :integer}
            }
          }
        },
        required: ['status', 'message', 'account']
      }
    end
  end
end
