class RemoveUniqueConstraintFromWebsiteHistoriesThreadId < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def up
    remove_index :website_histories, :thread_id, if_exists: true
    add_index :website_histories, :thread_id, algorithm: :concurrently
  end
  
  def down
    remove_index :website_histories, :thread_id, if_exists: true, algorithm: :concurrently
    add_index :website_histories, :thread_id, unique: true, algorithm: :concurrently
  end
end
