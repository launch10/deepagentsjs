class CreateAds < ActiveRecord::Migration[8.0]
  def change
    create_table :ads do |t|
      t.bigint :ad_group_id
      t.string :status, default: 'draft'
      t.string :display_path_1
      t.string :display_path_2
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :ad_group_id
      t.index :status
      t.index [:ad_group_id, :status]
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google')", name: "index_ads_on_google_id", if_not_exists: true
    end
  end
end
