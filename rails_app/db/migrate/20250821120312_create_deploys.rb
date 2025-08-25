class CreateDeploys < ActiveRecord::Migration[8.0]
  def change
    create_table :deploys do |t|
      t.bigint :website_id
      t.bigint :website_history_id
      t.string :status, null: false
      t.string :trigger, default: 'manual'
      t.text :stacktrace
      t.string :snapshot_id
      t.timestamps

      t.index :created_at
      t.index :website_id
      t.index :website_history_id
      t.index :snapshot_id
      t.index :status
      t.index :trigger
    end
  end
end
