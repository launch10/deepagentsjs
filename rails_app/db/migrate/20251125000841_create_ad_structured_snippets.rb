class CreateAdStructuredSnippets < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_structured_snippets do |t|
      t.bigint :campaign_id, null: false
      t.string :category, null: false
      t.jsonb :values, null: false, default: []
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :campaign_id
      t.index :created_at
      t.index :category
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google')", name: "index_ad_structured_snippets_on_google_id", if_not_exists: true
    end
  end
end
