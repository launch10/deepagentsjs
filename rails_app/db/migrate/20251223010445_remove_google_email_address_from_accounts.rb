class RemoveGoogleEmailAddressFromAccounts < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :accounts, :google_email_address, :string }
  end
end
