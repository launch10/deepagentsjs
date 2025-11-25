class CreateAds < ActiveRecord::Migration[8.0]
  def change
    create_table :ads do |t|
      t.bigint :ad_group_id
      t.string :status, default: 'draft'
      t.timestamps

      t.index :ad_group_id
      t.index :status
      t.index [:ad_group_id, :status]
    end
  end
end
