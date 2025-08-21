class ChangeProjectIdToWebsiteIdForWebsiteFileHistories < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :website_file_histories, :project_id, :website_id
      unless index_exists?(:website_file_histories, :website_id)
        add_index :website_file_histories, :website_id
      end
      if index_exists?(:website_file_histories, :project_id)
        remove_index :website_file_histories, :project_id
      end
    end
  end
end