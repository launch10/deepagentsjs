# frozen_string_literal: true

class ConvertCreditTransactionToMillicredits < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # Rename columns
      rename_column :credit_transactions, :amount, :amount_millicredits
      rename_column :credit_transactions, :balance_after, :balance_after_millicredits
      rename_column :credit_transactions, :plan_balance_after, :plan_balance_after_millicredits
      rename_column :credit_transactions, :pack_balance_after, :pack_balance_after_millicredits

      # Multiply existing values by 1000 (1 credit = 1000 millicredits)
      execute "UPDATE credit_transactions SET amount_millicredits = amount_millicredits * 1000"
      execute "UPDATE credit_transactions SET balance_after_millicredits = balance_after_millicredits * 1000"
      execute "UPDATE credit_transactions SET plan_balance_after_millicredits = plan_balance_after_millicredits * 1000"
      execute "UPDATE credit_transactions SET pack_balance_after_millicredits = pack_balance_after_millicredits * 1000"
    end
  end

  def down
    safety_assured do
      # Divide values by 1000 first (integer division, truncates)
      execute "UPDATE credit_transactions SET amount_millicredits = amount_millicredits / 1000"
      execute "UPDATE credit_transactions SET balance_after_millicredits = balance_after_millicredits / 1000"
      execute "UPDATE credit_transactions SET plan_balance_after_millicredits = plan_balance_after_millicredits / 1000"
      execute "UPDATE credit_transactions SET pack_balance_after_millicredits = pack_balance_after_millicredits / 1000"

      # Rename columns back
      rename_column :credit_transactions, :amount_millicredits, :amount
      rename_column :credit_transactions, :balance_after_millicredits, :balance_after
      rename_column :credit_transactions, :plan_balance_after_millicredits, :plan_balance_after
      rename_column :credit_transactions, :pack_balance_after_millicredits, :pack_balance_after
    end
  end
end
