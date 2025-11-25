class CreateAdCallouts < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_callouts do |t|
      t.bigint :campaign_id, null: false
      t.bigint :ad_group_id
      t.string :text, null: false
      t.integer :position, null: false

      t.timestamps

      t.index :campaign_id
      t.index :ad_group_id
      t.index :created_at
      t.index :position
    end
  end
end
