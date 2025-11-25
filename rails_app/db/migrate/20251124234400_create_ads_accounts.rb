class CreateAdsAccounts < ActiveRecord::Migration[8.0]
  def change
    create_table :ads_accounts do |t|
      t.bigint :account_id, null: false
      t.string :platform, null: false
      t.jsonb :platform_settings, default: {}
      t.timestamps

      t.index :account_id
      t.index :platform
      t.index [:account_id, :platform], unique: true
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google')", name: "index_ads_accounts_on_google_id", if_not_exists: true
    end
  end
end
