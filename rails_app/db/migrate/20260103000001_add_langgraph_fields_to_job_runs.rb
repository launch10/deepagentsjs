class AddLanggraphFieldsToJobRuns < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :job_runs, :account_id, :bigint
    add_column :job_runs, :langgraph_thread_id, :string
    add_column :job_runs, :langgraph_callback_url, :string
    add_column :job_runs, :result_data, :jsonb, default: {}

    add_index :job_runs, :account_id, algorithm: :concurrently
    add_index :job_runs, :langgraph_thread_id, algorithm: :concurrently
  end
end
