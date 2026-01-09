class RemoveLanggraphCallbackUrlFromJobRuns < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :job_runs, :langgraph_callback_url, :string }
  end
end
