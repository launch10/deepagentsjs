class AddCreditsUsedToCreditPackPurchases < ActiveRecord::Migration[8.0]
  def change
    add_column :credit_pack_purchases, :credits_used, :integer, null: false, default: 0
  end
end
