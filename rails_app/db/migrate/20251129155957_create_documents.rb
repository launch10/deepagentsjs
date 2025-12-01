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

      t.index :slug, unique: true
      t.index :status
      t.index :document_type
      t.index :source_type
      t.index :tags, using: :gin
      t.index :metadata, using: :gin
      t.index :last_synced_at
      t.index [:source_type, :source_id], unique: true
    end
  end
end
