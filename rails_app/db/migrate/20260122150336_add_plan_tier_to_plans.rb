class AddPlanTierToPlans < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :plans, :plan_tier_id, :bigint
    add_index :plans, :plan_tier_id, algorithm: :concurrently
  end
end
