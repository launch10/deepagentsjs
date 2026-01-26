# frozen_string_literal: true

class AddCreditsAllocatedToCreditPackPurchasesAndCreditGifts < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :credit_pack_purchases, :credits_allocated, :boolean, default: false, null: false
    add_column :credit_gifts, :credits_allocated, :boolean, default: false, null: false

    add_index :credit_pack_purchases, :credits_allocated, algorithm: :concurrently
    add_index :credit_gifts, :credits_allocated, algorithm: :concurrently
  end
end
