class CreateProjectWorkflows < ActiveRecord::Migration[8.0]
  def change
    create_table :project_workflows do |t|
      t.bigint :project_id, null: false
      t.string :workflow_type, null: false # launch, lead_magnet, ab_test, etc.
      t.string :step, null: false # brainstorm, website, ads, etc.
      t.string :substep # keywords, titles, etc.
      t.string :status, null: false, default: "active" # active, completed, archived
      t.jsonb :data, default: {}
      t.timestamps

      t.index :project_id
      t.index :workflow_type
      t.index :step
      t.index :substep
      t.index :status
      t.index :created_at
      t.index [:project_id, :workflow_type]
      t.index [:project_id, :workflow_type, :status]
    end
  end
end
