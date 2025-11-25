class CreateAdStructuredSnippets < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_structured_snippets do |t|
      t.bigint :campaign_id, null: false
      t.string :category, null: false
      t.jsonb :values, null: false, default: []
      t.timestamps

      t.index :campaign_id
      t.index :created_at
      t.index :category
    end
  end
end
