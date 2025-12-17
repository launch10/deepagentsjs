class AddTimeZoneToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :time_zone, :string, default: "America/New_York"
  end
end
