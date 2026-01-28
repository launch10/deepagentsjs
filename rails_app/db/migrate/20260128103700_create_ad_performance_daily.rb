# Raw Google Ads performance data - stored exactly as returned from API.
# This is our source of truth. We can always re-transform without re-fetching.
class CreateAdPerformanceDaily < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_performance_daily do |t|
      t.bigint :campaign_id, null: false
      t.date :date, null: false

      # Raw metrics from Google Ads API - stored unmassaged
      t.bigint :impressions, default: 0, null: false
      t.bigint :clicks, default: 0, null: false
      t.bigint :cost_micros, default: 0, null: false
      t.decimal :conversions, precision: 12, scale: 2, default: 0, null: false
      t.bigint :conversion_value_micros, default: 0, null: false

      t.timestamps
    end

    # Unique constraint enables idempotent upserts (7-day rolling window sync)
    add_index :ad_performance_daily, [:campaign_id, :date],
              unique: true, name: "idx_ad_perf_daily_campaign_date"

    # For aggregating by date range
    add_index :ad_performance_daily, :date

    # Foreign key - safe on new table creation
    safety_assured { add_foreign_key :ad_performance_daily, :campaigns }
  end
end
