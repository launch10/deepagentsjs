class CreateCreditPacks < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :credit_packs do |t|
      t.string :name, null: false
      t.integer :credits, null: false
      t.integer :price_cents, null: false
      t.string :currency, default: "usd"
      t.string :stripe_price_id
      t.boolean :visible, default: true

      t.timestamps
    end

    add_index :credit_packs, :name, unique: true, algorithm: :concurrently
  end
end
