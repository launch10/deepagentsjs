class CreateAdsAccountInvitations < ActiveRecord::Migration[8.0]
  def change
    create_table :ads_account_invitations do |t|
      t.references :ads_account, null: false, foreign_key: true
      t.string :email_address, null: false
      t.string :platform, null: false
      t.jsonb :platform_settings, default: {}
      t.timestamps
    end

    add_index :ads_account_invitations, [:ads_account_id, :email_address, :platform], name: "idx_ads_account_invitations_lookup"
    add_index :ads_account_invitations, :platform
    add_index :ads_account_invitations, :platform_settings, using: :gin
  end
end
