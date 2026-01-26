# frozen_string_literal: true

class ConvertAccountCreditsToMillicredits < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # Rename columns
      rename_column :accounts, :plan_credits, :plan_millicredits
      rename_column :accounts, :pack_credits, :pack_millicredits
      rename_column :accounts, :total_credits, :total_millicredits

      # Multiply existing values by 1000 (1 credit = 1000 millicredits)
      execute "UPDATE accounts SET plan_millicredits = plan_millicredits * 1000"
      execute "UPDATE accounts SET pack_millicredits = pack_millicredits * 1000"
      execute "UPDATE accounts SET total_millicredits = total_millicredits * 1000"
    end
  end

  def down
    safety_assured do
      # Divide values by 1000 first (integer division, truncates)
      execute "UPDATE accounts SET plan_millicredits = plan_millicredits / 1000"
      execute "UPDATE accounts SET pack_millicredits = pack_millicredits / 1000"
      execute "UPDATE accounts SET total_millicredits = total_millicredits / 1000"

      # Rename columns back
      rename_column :accounts, :plan_millicredits, :plan_credits
      rename_column :accounts, :pack_millicredits, :pack_credits
      rename_column :accounts, :total_millicredits, :total_credits
    end
  end
end
