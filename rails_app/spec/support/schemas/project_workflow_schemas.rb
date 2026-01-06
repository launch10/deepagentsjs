# frozen_string_literal: true

module APISchemas
  module ProjectWorkflow
    def self.response
      {
        type: :object,
        properties: {
          workflow_type: {type: :string, description: 'Type of workflow'},
          page: {type: :string, description: 'Current page in the workflow'},
          substep: {type: :string, nullable: true, description: 'Current substep in the workflow'},
          progress: {type: :number, description: 'Progress percentage (0-100)'},
          available_steps: {
            type: :array,
            items: {type: :string},
            description: 'List of available steps in this workflow'
          }
        },
        required: ['workflow_type', 'page', 'progress', 'available_steps']
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          project_workflow: {
            type: :object,
            properties: {
              step: {
                type: :string,
                description: 'Step to advance to'
              },
              substep: {
                type: :string,
                description: 'Optional substep to advance to'
              }
            },
            required: ['step']
          }
        },
        required: ['project_workflow']
      }
    end
  end
end
