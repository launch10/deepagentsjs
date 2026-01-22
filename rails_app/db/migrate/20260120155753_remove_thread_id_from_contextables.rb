class RemoveThreadIdFromContextables < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      # Thread ID is now managed by Chat (via ChatCreatable concern)
      # Models delegate thread_id to chat.thread_id

      # Brainstorm
      remove_index :brainstorms, :thread_id, if_exists: true
      remove_column :brainstorms, :thread_id, :string

      # Website
      remove_index :websites, :thread_id, if_exists: true
      remove_column :websites, :thread_id, :string

      # Deploy (was langgraph_thread_id)
      remove_index :deploys, :langgraph_thread_id, if_exists: true
      remove_column :deploys, :langgraph_thread_id, :string
    end
  end
end
