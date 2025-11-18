class AddVersioningToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :deploys, :is_live, :boolean, default: false
    add_column :deploys, :revertible, :boolean, default: false
    add_column :deploys, :version_path, :string

    add_index :deploys, :is_live, algorithm: :concurrently
    add_index :deploys, :revertible, algorithm: :concurrently
    add_index :deploys, [:website_id, :is_live], algorithm: :concurrently
  end
end
