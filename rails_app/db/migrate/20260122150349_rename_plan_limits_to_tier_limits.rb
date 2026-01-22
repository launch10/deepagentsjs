class RenamePlanLimitsToTierLimits < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Add new FK column first (without foreign_key constraint initially)
    safety_assured { add_reference :plan_limits, :plan_tier, index: {algorithm: :concurrently} }

    # Rename the table
    safety_assured { rename_table :plan_limits, :tier_limits }
  end
end
