class AddCreditColumnsToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :plan_credits, :bigint, default: 0, null: false
    add_column :accounts, :pack_credits, :bigint, default: 0, null: false
    add_column :accounts, :total_credits, :bigint, default: 0, null: false
  end
end
