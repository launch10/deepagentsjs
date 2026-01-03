class AddForeignKeyToJobRunsAccount < ActiveRecord::Migration[8.0]
  def change
    add_foreign_key :job_runs, :accounts, validate: false
  end
end
