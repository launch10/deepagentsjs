class CreateIconEmbeddings < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute "CREATE EXTENSION IF NOT EXISTS vector;"
    end

    create_table :icon_embeddings do |t|
      t.string :key, null: false
      t.text :text, null: false
      t.vector :embedding, limit: 1536, null: false
      t.jsonb :metadata, null: false, default: {}
      t.timestamps

      t.index :key, unique: true
    end

    safety_assured do
      execute "CREATE INDEX idx_icon_embeddings_text ON icon_embeddings USING IVFFlat (embedding vector_cosine_ops);"
    end
  end

  def down
    drop_table :icon_embeddings
  end
end
