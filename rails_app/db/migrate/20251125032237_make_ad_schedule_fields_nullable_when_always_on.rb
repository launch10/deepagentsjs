class MakeAdScheduleFieldsNullableWhenAlwaysOn < ActiveRecord::Migration[8.0]
  def change
    change_column_null :ad_schedules, :day_of_week, true
    change_column_null :ad_schedules, :start_hour, true
    change_column_null :ad_schedules, :start_minute, true
    change_column_null :ad_schedules, :end_hour, true
    change_column_null :ad_schedules, :end_minute, true
  end
end
