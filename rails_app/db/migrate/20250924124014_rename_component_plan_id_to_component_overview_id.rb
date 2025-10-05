class RenameComponentPlanIdToComponentOverviewId < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :components, :component_plan_id, :component_overview_id
    end
  end
end
