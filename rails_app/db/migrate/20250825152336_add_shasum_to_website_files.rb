class AddShasumToWebsiteFiles < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :website_files, :shasum, :string
    add_index :website_files, :shasum, algorithm: :concurrently
  end
end
