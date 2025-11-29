class CreateJobRuns < ActiveRecord::Migration[8.0]
  def change
    create_table :job_runs do |t|
      t.string :job_class, null: false
      t.string :status, null: false, default: 'pending'
      t.text :error_message
      t.jsonb :job_args, default: {}
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps

      t.index :job_class
      t.index :status
      t.index [:job_class, :status]
      t.index :created_at
    end
  end
end
