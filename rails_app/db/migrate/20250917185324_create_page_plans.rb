class CreatePagePlans < ActiveRecord::Migration[8.0]
  def change
    create_table :page_plans do |t|
      t.bigint :website_id
      t.string :page_type
      t.string :description

      t.timestamps

      t.index :created_at
      t.index :page_type
      t.index :website_id
    end
  end
end
