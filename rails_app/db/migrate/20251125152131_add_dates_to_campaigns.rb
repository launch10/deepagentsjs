class AddDatesToCampaigns < ActiveRecord::Migration[8.0]
  def change
    add_column :campaigns, :start_date, :date
    add_column :campaigns, :end_date, :date
  end
end
