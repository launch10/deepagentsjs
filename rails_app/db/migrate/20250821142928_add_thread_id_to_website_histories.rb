class AddThreadIdToWebsiteHistories < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :website_histories, :thread_id, :string
    add_index :website_histories, :thread_id, algorithm: :concurrently
  end
end
