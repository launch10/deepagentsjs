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
    end
  end
end
