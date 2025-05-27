class CreateProjects < ActiveRecord::Migration[8.0]
  def change
    create_table :projects do |t|
      t.string :name, null: false
      t.bigint :account_id, null: false
      t.bigint :theme_id
      t.string :thread_id, null: false
      t.timestamps

      t.index :name
      t.index :account_id
      t.index :theme_id
      t.index :thread_id
      t.index :created_at
      t.index :updated_at
      t.index [:account_id, :name], unique: true
      t.index [:account_id, :created_at]
      t.index [:account_id, :updated_at]
      t.index [:account_id, :thread_id], unique: true
    end
  end
end
