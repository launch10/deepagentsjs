class AddThemeIdToWebsiteHistories < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :website_histories, :theme_id, :integer
    add_index :website_histories, :theme_id, algorithm: :concurrently
  end
end
