class AddWebsiteFileIdToComponents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :components, :website_file_id, :integer
    add_index :components, :website_file_id, algorithm: :concurrently
  end
end
