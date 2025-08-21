class AddThreadIdToWebsites < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :websites, :thread_id, :string
    add_index :websites, :thread_id, unique: true, algorithm: :concurrently
  end
end
