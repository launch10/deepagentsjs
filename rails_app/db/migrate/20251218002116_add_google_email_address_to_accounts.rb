class AddGoogleEmailAddressToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :google_email_address, :string
  end
end
