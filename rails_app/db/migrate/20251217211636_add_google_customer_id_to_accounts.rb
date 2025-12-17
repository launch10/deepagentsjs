class AddGoogleCustomerIdToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :google_customer_id, :string
  end
end
