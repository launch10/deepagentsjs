class AddSortOrderToComponentOverviews < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :component_overviews, :sort_order, :integer
    add_index :component_overviews, :sort_order, algorithm: :concurrently
  end
end
