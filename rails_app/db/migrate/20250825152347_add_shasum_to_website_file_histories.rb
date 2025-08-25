class AddShasumToWebsiteFileHistories < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :website_file_histories, :shasum, :string
    add_index :website_file_histories, :shasum, algorithm: :concurrently
  end
end
