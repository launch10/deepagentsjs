class AddErrorTypeToJobRuns < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :job_runs, :error_type, :string, if_not_exists: true
    add_index :job_runs, :error_type, algorithm: :concurrently, if_not_exists: true
  end
end
