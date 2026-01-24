class CreateCreditPackPurchases < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_pack_purchases do |t|
      t.bigint :account_id, null: false
      t.bigint :credit_pack_id, null: false
      t.bigint :pay_charge_id
      t.integer :credits_purchased, null: false
      t.integer :price_cents, null: false
      t.boolean :is_used, null: false, default: false

      t.timestamps
    end

    add_index :credit_pack_purchases, :account_id, algorithm: :concurrently
    add_index :credit_pack_purchases, :credit_pack_id, algorithm: :concurrently
    add_index :credit_pack_purchases, :pay_charge_id, algorithm: :concurrently
    add_index :credit_pack_purchases, [:account_id, :is_used], algorithm: :concurrently
    add_index :credit_pack_purchases, [:account_id, :created_at], algorithm: :concurrently
  end
end
