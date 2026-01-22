class AddPlanTierToPlans < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :plans, :plan_tier, index: {algorithm: :concurrently}
  end
end
