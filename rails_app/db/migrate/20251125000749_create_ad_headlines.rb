class CreateHeadlines < ActiveRecord::Migration[8.0]
  def change
    create_table :headlines do |t|
      t.bigint :ad_id, null: false
      t.string :text, null: false
      t.integer :position, null: false

      t.timestamps

      t.index :ad_id
      t.index :created_at
      t.index :position
      t.index [:ad_id, :position]
    end
  end
end
