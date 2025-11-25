class CreateAdGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_groups do |t|
      t.bigint :campaign_id
      t.string :name
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :campaign_id
      t.index :name
      t.index [:campaign_id, :name]
      t.index :created_at
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google'->>'ad_group_id')", name: "index_ad_groups_on_google_id", if_not_exists: true
    end
  end
end
