class ChangeProjectToWebsiteForContentStrategies < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      remove_column :content_strategies, :project_id
      add_column :content_strategies, :website_id, :integer
      add_index :content_strategies, :website_id
    end
  end

  def down
    safety_assured do
      remove_column :content_strategies, :website_id
      add_column :content_strategies, :project_id, :integer
      add_index :content_strategies, :project_id
    end
  end
end
