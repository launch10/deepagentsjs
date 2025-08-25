class AddEnvironmentAndPreviewToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def change
    add_column :deploys, :environment, :string, default: 'production', null: false
    add_column :deploys, :is_preview, :boolean, default: false, null: false
    
    add_index :deploys, :environment, algorithm: :concurrently
    add_index :deploys, :is_preview, algorithm: :concurrently
    add_index :deploys, [:website_id, :environment, :is_preview], algorithm: :concurrently
  end
end
