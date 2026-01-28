# frozen_string_literal: true

class CreateCreditUsageAdjustments < ActiveRecord::Migration[8.0]
  def change
    create_table :credit_usage_adjustments do |t|
      t.references :account, null: false, foreign_key: true
      t.references :admin, null: false, foreign_key: {to_table: :users}
      t.integer :amount, null: false
      t.string :reason, null: false
      t.text :notes
      t.boolean :credits_adjusted, null: false, default: false

      t.timestamps
    end

    add_index :credit_usage_adjustments, [:account_id, :created_at]
    add_index :credit_usage_adjustments, :credits_adjusted
  end
end
