class AddComponentIdToComponentContentPlans < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :component_content_plans, :component_id, :integer
    add_index :component_content_plans, :component_id, algorithm: :concurrently
  end
end
