class CreateDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :documents do |t|
      t.string :slug, null: false
      t.string :title
      t.text :content
      t.string :status, default: 'draft', null: false
      t.string :document_type
      t.string :source_type
      t.string :source_id
      t.string :source_url
      t.jsonb :tags, default: []
      t.jsonb :metadata, default: {}
      t.datetime :last_synced_at
      t.timestamps
    end

    add_index :documents, :slug, unique: true
    add_index :documents, :status
    add_index :documents, :document_type
    add_index :documents, :source_type
    add_index :documents, :tags, using: :gin
  end
end
