class CleanupTierLimitsColumns < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Remove old plan_id column and its indexes
    safety_assured do
      remove_index :tier_limits, :plan_id, if_exists: true
      remove_index :tier_limits, [:plan_id, :limit_type], if_exists: true
      remove_column :tier_limits, :plan_id, :bigint
    end

    # Rename plan_tier_id to tier_id
    safety_assured { rename_column :tier_limits, :plan_tier_id, :tier_id }

    # Add unique constraint on (tier_id, limit_type)
    add_index :tier_limits, [:tier_id, :limit_type], unique: true, algorithm: :concurrently
  end
end
