class AddPerUnitBilling < ActiveRecord::Migration[7.0]
  def self.up
    # Introduce counter cache for per-user billing
    add_column :accounts, :account_users_count, :integer, default: 0
    # Backfill account_users_count efficiently
    safety_assured do
      execute "UPDATE accounts SET account_users_count = (SELECT count(1) FROM account_users WHERE account_users.account_id = accounts.id);"
    end

    add_column :plans, :charge_per_unit, :boolean, algorithm: :concurrently
    safety_assured do
      rename_column :plans, :unit, :unit_label
    end
  end

  def self.down
    remove_column :accounts, :account_users_count
    remove_column :plans, :charge_per_unit
    rename_column :plans, :unit_label, :unit
  end
end
