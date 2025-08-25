require "historiographer/postgres_migration"

class CreateWebsiteHistories < ActiveRecord::Migration[8.0]
  def change
    create_table :website_histories do |t|
      t.bigint :website_id
      t.string :name
      t.bigint :project_id
      t.bigint :account_id
      t.string :thread_id
      t.bigint :template_id
      t.datetime :history_started_at
      t.datetime :history_ended_at
      t.bigint :history_user_id
      t.string :snapshot_id

      t.timestamps
      t.index :created_at
      t.index :website_id
      t.index :history_started_at
      t.index :history_ended_at
      t.index :history_user_id
      t.index :snapshot_id
      t.index :thread_id
      t.index :template_id
    end
  end
end
