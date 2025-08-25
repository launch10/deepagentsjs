class CreateWebsites < ActiveRecord::Migration[8.0]
  def change
    create_table :websites do |t|
      t.string :name
      t.bigint :project_id
      t.bigint :account_id
      t.string :thread_id
      t.bigint :template_id

      t.timestamps
      t.index :name
      t.index :project_id
      t.index :account_id
      t.index :thread_id, unique: true
      t.index :template_id
      t.index :created_at
    end
  end
end
