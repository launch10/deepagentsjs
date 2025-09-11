class MoveThemeIdToWebsites < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def change
    safety_assured do
      remove_column :projects, :theme_id
      add_column :websites, :theme_id, :integer
      add_index :websites, :theme_id, algorithm: :concurrently
    end
  end
end
