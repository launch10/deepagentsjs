class AddGoogleAdsFieldsToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :google_email_address, :string
    add_column :accounts, :time_zone, :string, default: "America/New_York"
  end
end
