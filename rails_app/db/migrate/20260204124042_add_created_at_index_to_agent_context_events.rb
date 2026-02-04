class AddCreatedAtIndexToAgentContextEvents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :agent_context_events, :created_at, algorithm: :concurrently
  end
end
