class AddConversionValueCentsToAnalyticsDailyMetrics < ActiveRecord::Migration[8.0]
  def change
    add_column :analytics_daily_metrics, :conversion_value_cents, :bigint, default: 0, null: false
  end
end
