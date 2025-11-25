class AddTimeZoneToCampaigns < ActiveRecord::Migration[8.0]
  def change
    add_column :campaigns, :time_zone, :string, default: 'America/New_York'
  end
end
