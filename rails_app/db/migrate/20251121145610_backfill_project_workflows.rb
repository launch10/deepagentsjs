class BackfillProjectWorkflows < ActiveRecord::Migration[8.0]
  def change
    projects = Project.all
    projects.each { |p| p.uuid = UUID7.generate }
    Project.import(projects.to_a, on_duplicate_key_update: { conflict_target: [:id], columns: [:uuid] })

    workflows = projects.map do |p|
      ProjectWorkflow.new(project: p, workflow_type: "launch").tap do
        workflow.valid?
      end
    end

    ProjectWorkflow.import(workflows.to_a)
  end
end
