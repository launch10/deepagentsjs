class CreateCreditTransactions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_transactions do |t|
      t.bigint :account_id, null: false
      t.string :transaction_type, null: false
      t.string :credit_type, null: false
      t.string :reason, null: false
      t.bigint :amount, null: false
      t.bigint :balance_after, null: false
      t.bigint :plan_balance_after, null: false
      t.bigint :pack_balance_after, null: false
      t.string :reference_type
      t.string :reference_id
      t.jsonb :metadata, default: {}
      t.string :idempotency_key

      t.timestamps
    end

    add_index :credit_transactions, [:account_id, :created_at], algorithm: :concurrently
    add_index :credit_transactions, [:reference_type, :reference_id], algorithm: :concurrently
    add_index :credit_transactions, :idempotency_key, unique: true, where: "idempotency_key IS NOT NULL", algorithm: :concurrently
  end
end
