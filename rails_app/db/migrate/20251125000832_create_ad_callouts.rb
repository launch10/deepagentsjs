class CreateAdCallouts < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_callouts do |t|
      t.bigint :campaign_id, null: false
      t.bigint :ad_group_id
      t.string :text, null: false
      t.integer :position, null: false
      t.jsonb :platform_settings, default: { google: {}, meta: {} }

      t.timestamps

      t.index :campaign_id
      t.index :ad_group_id
      t.index :created_at
      t.index :position
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->'google'->>'asset_id')", name: "index_ad_callouts_on_asset_id", if_not_exists: true
    end
  end
end
