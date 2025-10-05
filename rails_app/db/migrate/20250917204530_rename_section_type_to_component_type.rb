class RenameSectionTypeToComponentType < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :component_content_plans, :section_type, :component_type
    end
  end
end
