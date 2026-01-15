class AddDeployIdToJobRuns < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :job_runs, :deploy_id, :bigint
    add_index :job_runs, :deploy_id, algorithm: :concurrently
  end
end
