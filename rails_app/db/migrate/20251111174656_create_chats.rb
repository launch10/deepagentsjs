class CreateChats < ActiveRecord::Migration[8.0]
  def change
    create_table :chats do |t|
      t.string :name
      t.string :type, null: false # brainstorm, website, ads, etc.
      t.string :thread_id, null: false
      t.bigint :project_id, null: false
      t.bigint :account_id, null: false
      t.string :contextable_type
      t.bigint :contextable_id

      t.timestamps

      t.index :project_id
      t.index :account_id
      t.index :thread_id
      t.index :type
      t.index [:type, :project_id], unique: true
    end
  end
end
