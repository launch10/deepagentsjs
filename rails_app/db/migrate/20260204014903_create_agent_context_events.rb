class CreateAgentContextEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :agent_context_events do |t|
      t.bigint :account_id, null: false
      t.bigint :project_id  # nullable for account-level events
      t.bigint :user_id     # nullable for system events
      t.string :eventable_type
      t.bigint :eventable_id

      t.string :event_type, null: false
      t.jsonb :payload, default: {}

      t.timestamps
    end

    add_index :agent_context_events, :account_id
    add_index :agent_context_events, [:project_id, :created_at]
    add_index :agent_context_events, :event_type
    add_index :agent_context_events, [:eventable_type, :eventable_id]
  end
end
