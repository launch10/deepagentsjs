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
    end
  end
end
