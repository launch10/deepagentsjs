class AddIndexesToPaySubscriptionsForReconciliation < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Index for filtering active subscriptions
    add_index :pay_subscriptions, :status, algorithm: :concurrently

    # Functional index for reset day lookups (EXTRACT(DAY FROM current_period_start))
    add_index :pay_subscriptions,
      "EXTRACT(DAY FROM current_period_start)",
      name: "index_pay_subscriptions_on_reset_day",
      algorithm: :concurrently
  end
end
