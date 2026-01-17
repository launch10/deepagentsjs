class AddDeletedAtToProjectsAndWebsites < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :projects, :deleted_at, :datetime, if_not_exists: true
    add_column :websites, :deleted_at, :datetime, if_not_exists: true

    add_index :projects, :deleted_at, algorithm: :concurrently, if_not_exists: true
    add_index :websites, :deleted_at, algorithm: :concurrently, if_not_exists: true
  end
end
