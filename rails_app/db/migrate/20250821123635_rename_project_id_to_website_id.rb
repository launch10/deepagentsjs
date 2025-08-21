class RenameProjectIdToWebsiteId < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :website_files, :project_id, :website_id
    end
  end
end
