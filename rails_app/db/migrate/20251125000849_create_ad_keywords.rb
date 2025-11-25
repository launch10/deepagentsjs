class CreateAdKeywords < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_keywords do |t|
      t.bigint :ad_group_id, null: false
      t.string :text, null: false, limit: 120
      t.string :match_type, null: false, default: 'broad'
      t.integer :position, null: false
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :ad_group_id
      t.index :created_at
      t.index :match_type
      t.index :position
      t.index :text
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google')", name: "index_ad_keywords_on_google_id", if_not_exists: true
    end
  end
end
