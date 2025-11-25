class CreateAdHeadlines < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_headlines do |t|
      t.bigint :ad_id, null: false
      t.string :text, null: false
      t.integer :position, null: false
      t.jsonb :platform_settings, default: { google: {}, meta: {} }

      t.timestamps

      t.index :ad_id
      t.index :created_at
      t.index :position
      t.index [:ad_id, :position]
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->'google'->>'asset_id')", name: "index_ad_headlines_on_asset_id", if_not_exists: true
    end
  end
end
