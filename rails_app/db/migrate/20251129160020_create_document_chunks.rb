class CreateDocumentChunks < ActiveRecord::Migration[8.0]
  def change
    create_table :document_chunks do |t|
      t.references :document, null: false, foreign_key: true
      t.string :question_hash, null: false
      t.text :question, null: false
      t.text :answer, null: false
      t.text :content
      t.string :section
      t.jsonb :context, default: {}
      t.integer :position
      t.vector :embedding, limit: 1536
      t.timestamps
    end

    add_index :document_chunks, [:document_id, :question_hash], unique: true
    add_index :document_chunks, :section
    add_index :document_chunks, :embedding, using: :ivfflat, opclass: :vector_cosine_ops, name: 'idx_document_chunks_embedding'
  end
end
