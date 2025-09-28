class AddWebsiteFileIdToCodeTasks < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :tasks, :website_file_id, :integer
    add_index :tasks, :website_file_id, algorithm: :concurrently
  end
end
