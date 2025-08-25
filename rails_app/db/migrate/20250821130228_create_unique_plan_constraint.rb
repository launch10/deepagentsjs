class CreateUniquePlanConstraint < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def change
    add_index :plans, :name, unique: true, algorithm: :concurrently
  end
end
