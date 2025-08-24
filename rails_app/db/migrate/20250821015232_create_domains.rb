class CreateDomains < ActiveRecord::Migration[8.0]
  def change
    create_table :domains do |t|
      t.string :domain
      t.bigint :website_id
      t.bigint :account_id
      t.string :cloudflare_zone_id

      t.timestamps
      t.index :domain
      t.index :account_id
      t.index :website_id
      t.index :created_at
      t.index :cloudflare_zone_id
    end
  end
end
