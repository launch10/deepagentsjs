class CreateIconQueryCache < ActiveRecord::Migration[8.0]
  def change
    create_table :icon_query_caches do |t|
      t.string :query, null: false
      t.jsonb :results, null: false, default: []
      t.integer :use_count, null: false, default: 0
      t.integer :ttl_seconds, null: false, default: 86400
      t.float :min_similarity, null: false, default: 0.7
      t.integer :top_k, null: false
      t.timestamp :last_used_at, null: false
      t.timestamps

      t.index :query
      t.index :top_k
      t.index :use_count
      t.index :ttl_seconds
      t.index :last_used_at
      t.index :min_similarity
    end
  end
end
