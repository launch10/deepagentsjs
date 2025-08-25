class AddUniqueIndexToWebsiteFilesPath < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def change
    add_index :website_files, [:website_id, :path], unique: true, algorithm: :concurrently, name: 'index_website_files_on_website_id_and_path_unique'
  end
end
