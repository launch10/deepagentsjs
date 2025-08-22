class AddTemplateIdToWebsiteHistories < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
 
  def up
    add_column :website_histories, :template_id, :integer
    unless index_exists?(:website_histories, :template_id)
      add_index :website_histories, :template_id, algorithm: :concurrently
    end
  end

  def down
    remove_column :website_histories, :template_id if column_exists?(:website_histories, :template_id)
    remove_index :website_histories, :template_id if index_exists?(:website_histories, :template_id)
  end
end