# frozen_string_literal: true

class CreateCreditGifts < ActiveRecord::Migration[8.0]
  def change
    create_table :credit_gifts do |t|
      t.bigint :account_id, null: false
      t.bigint :admin_id, null: false
      t.integer :amount, null: false
      t.string :reason, null: false
      t.text :notes

      t.timestamps
    end

    add_index :credit_gifts, :account_id
    add_index :credit_gifts, :admin_id
    add_index :credit_gifts, [:account_id, :created_at]
  end
end
