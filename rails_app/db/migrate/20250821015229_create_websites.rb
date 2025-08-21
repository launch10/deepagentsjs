class CreateWebsites < ActiveRecord::Migration[8.0]
  def change
    create_table :websites do |t|
      t.string :name
      t.bigint :project_id
      t.bigint :user_id

      t.timestamps
      t.index :name
      t.index :project_id
      t.index :user_id
      t.index :created_at
    end
  end
end
