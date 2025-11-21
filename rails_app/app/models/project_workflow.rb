# == Schema Information
#
# Table name: project_workflows
#
#  id            :bigint           not null, primary key
#  data          :jsonb
#  status        :string           default("active"), not null
#  step          :string           not null
#  substep       :string
#  workflow_type :string           not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  project_id    :bigint           not null
#
# Indexes
#
#  idx_on_project_id_workflow_type_status_a7aa4433b7        (project_id,workflow_type,status)
#  index_project_workflows_on_created_at                    (created_at)
#  index_project_workflows_on_project_id                    (project_id)
#  index_project_workflows_on_project_id_and_workflow_type  (project_id,workflow_type)
#  index_project_workflows_on_status                        (status)
#  index_project_workflows_on_step                          (step)
#  index_project_workflows_on_substep                       (substep)
#  index_project_workflows_on_workflow_type                 (workflow_type)
#
class ProjectWorkflow < ApplicationRecord
  belongs_to :project

  validates :workflow_type, presence: true
  validates :status, inclusion: { in: %w[active completed archived] }
  validates :step, presence: true
  validate :only_one_launch_workflow_per_project
  before_validation :set_default_values, on: :create

  scope :active, -> { where(status: 'active') }
  scope :completed, -> { where(status: 'completed') }
  scope :archived, -> { where(status: 'archived') }
  scope :launch, -> { where(workflow_type: 'launch') }

  def next_step!
    next_step, next_substep = WorkflowConfig.next(workflow_type, step, substep)
    unless next_step
      complete!
      return [nil, nil]
    end
    update(step: next_step, substep: next_substep)
    [next_step, next_substep]
  end

  def next_step
    WorkflowConfig.next_step(workflow_type, step)
  end

  def advance_to(step:, substep: nil)
    if substep.nil?
      substep = WorkflowConfig.first_substep(workflow_type, step)
    end
    return false unless valid_step?(step, substep)

    update(step: step, substep: substep)
  end

  def valid_step?(step, substep)
    WorkflowConfig.step_exists?(workflow_type, step) && (substep.nil? || WorkflowConfig.substep_exists?(workflow_type, step, substep))
  end

  def completed?
    status == 'completed'
  end

  def archived?
    status == 'archived'
  end

  def active?
    status == 'active'
  end

  def complete!
    update(status: 'completed')
  end

  def as_json
    {
      workflow_type: workflow_type,
      step: step,
      substep: substep,
      progress: calculate_progress,
      available_steps: WorkflowConfig.steps_for(workflow_type)
    }
  end

  private

  def calculate_progress
    config = WorkflowConfig.definition(workflow_type)
    return 0 unless step.present?

    total_steps = config.steps.count
    completed = config.steps.keys.index(step) || 0

    (completed.to_f / total_steps * 100).round
  end

  def set_default_values
    self.status ||= "active"
    self.workflow_type = (workflow_type.nil? || workflow_type.empty?) ? "launch" : workflow_type
    self.step ||= WorkflowConfig.first_step(workflow_type)
    self.substep ||= WorkflowConfig.first_substep(workflow_type)
  end

  def only_one_launch_workflow_per_project
    return unless project

    if project.workflows.where(workflow_type: "launch").where.not(id: id).exists?
      errors.add(:workflow_type, "Only one launch workflow per project is allowed")
    end
  end
end
