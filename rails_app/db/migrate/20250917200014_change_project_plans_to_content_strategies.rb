class ChangeProjectPlansToContentStrategies < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_table :project_plans, :content_strategies
    end
  end
end
