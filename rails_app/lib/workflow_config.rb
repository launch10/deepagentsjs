class WorkflowConfig
  class << self
    def definition(workflow_type)
      @configs ||= JSON.parse(File.read(Rails.root.join("../shared/exports/workflow.json")))
      @definitions ||= {}
      @definitions[workflow_type] ||= WorkflowDefinition.new(@configs[workflow_type])
    end

    def next(workflow_type, current_step, current_substep)
      if next_substep(workflow_type, current_step, current_substep)
        [
          current_step,
          next_substep(workflow_type, current_step, current_substep)
        ]
      elsif next_step(workflow_type, current_step)
        [
          next_step(workflow_type, current_step),
          first_substep(workflow_type, next_step(workflow_type, current_step))
        ]
      end
    end

    def prev(workflow_type, current_step, current_substep)
      if prev_substep(workflow_type, current_step, current_substep)
        [
          current_step,
          prev_substep(workflow_type, current_step, current_substep)
        ]
      elsif prev_step(workflow_type, current_step)
        [
          prev_step(workflow_type, current_step),
          last_substep(workflow_type, prev_step(workflow_type, current_step))
        ]
      end
    end

    def step_exists?(workflow_type, step)
      definition(workflow_type).steps.key?(step)
    end

    def substep_exists?(workflow_type, step, substep)
      definition(workflow_type).substeps_for(step).include?(substep)
    end

    def first_step(workflow_type)
      definition(workflow_type).steps.keys.first.to_s
    end

    def first_substep(workflow_type, step = nil)
      if step.nil?
        step = first_step(workflow_type)
      end
      definition(workflow_type).substeps_for(step).first
    end

    def last_substep(workflow_type, step = nil)
      if step.nil?
        step = last_step(workflow_type)
      end
      definition(workflow_type).substeps_for(step).last
    end

    def steps_for(workflow_type)
      definition(workflow_type).steps.keys.map(&:to_s)
    end

    def next_step(workflow_type, current_step)
      steps_for(workflow_type)[steps_for(workflow_type).index(current_step) + 1]
    end

    def prev_step(workflow_type, current_step)
      steps_for(workflow_type)[steps_for(workflow_type).index(current_step) - 1]
    end

    def prev_substep(workflow_type, current_step, current_substep)
      all_substeps = substeps_for(workflow_type, current_step)
      return nil unless all_substeps.any?

      current_substep_idx = all_substeps.index(current_substep)
      return nil if current_substep_idx.zero?

      all_substeps[current_substep_idx - 1]
    end

    def next_substep(workflow_type, current_step, current_substep)
      all_substeps = substeps_for(workflow_type, current_step)
      return nil unless all_substeps.any?

      all_substeps[all_substeps.index(current_substep) + 1]
    end

    def step_order(workflow_type, step_name)
      definition(workflow_type).step_order(step_name)
    end

    def substeps_for(workflow_type, step_name)
      definition(workflow_type).substeps_for(step_name)
    end
  end

  class WorkflowDefinition
    attr_reader :config

    def initialize(config)
      unless config.is_a?(Hash)
        raise ArgumentError, "Invalid workflow configuration: #{config.inspect}"
      end
      @config = config.with_indifferent_access
    end

    def steps
      @config["steps"]
    end

    def next_step(workflow_type, current_step)
      steps.index(current_step) + 1
    end

    def step_order(step_name)
      steps.dig(step_name, "order")
    end

    def substeps_for(step_name)
      steps.dig(step_name, "substeps") || []
    end
  end
end
