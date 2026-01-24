class CreateLlmUsage < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :llm_usage do |t|
      t.bigint :chat_id, null: false
      t.string :thread_id, null: false
      t.string :run_id, null: false
      t.string :message_id
      t.string :langchain_run_id
      t.string :parent_langchain_run_id
      t.string :graph_name
      t.string :model_raw, null: false
      t.integer :input_tokens, null: false, default: 0
      t.integer :output_tokens, null: false, default: 0
      t.integer :reasoning_tokens, default: 0
      t.integer :cache_creation_tokens, default: 0
      t.integer :cache_read_tokens, default: 0
      t.bigint :cost_microcents
      t.string :tags, array: true, default: []
      t.jsonb :metadata
      t.datetime :processed_at

      t.timestamps
    end

    add_index :llm_usage, :run_id, algorithm: :concurrently
    add_index :llm_usage, [:chat_id, :run_id], algorithm: :concurrently
    add_index :llm_usage, [:thread_id, :created_at], algorithm: :concurrently
    add_index :llm_usage, [:processed_at, :created_at], algorithm: :concurrently
  end
end
