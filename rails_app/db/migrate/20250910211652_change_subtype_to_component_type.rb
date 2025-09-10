class ChangeSubtypeToComponentType < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :file_specifications, :subtype, :component_type
    end
  end
end
