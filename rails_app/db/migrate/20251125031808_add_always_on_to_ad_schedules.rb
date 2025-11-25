class AddAlwaysOnToAdSchedules < ActiveRecord::Migration[8.0]
  def change
    add_column :ad_schedules, :always_on, :boolean, default: false, null: false
  end
end
