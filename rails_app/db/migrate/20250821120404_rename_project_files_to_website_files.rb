class RenameProjectFilesToWebsiteFiles < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      rename_table :project_files, :website_files
    end
  end

  def down
    safety_assured do
      rename_table :website_files, :project_files
    end
  end
end