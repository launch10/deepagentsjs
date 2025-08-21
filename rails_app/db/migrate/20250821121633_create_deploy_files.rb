require "historiographer/postgres_migration"

class CreateDeployFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :deploy_files do |t|
      t.bigint :deploy_id
      t.bigint :website_file_id

      t.timestamps
      t.index :created_at
      t.index :deploy_id
      t.index :website_file_id
    end
  end
end
