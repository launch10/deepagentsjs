# Transformed/aggregated analytics data - one row per project per day.
# Can be fully recomputed from raw sources (ad_performance_daily, website_leads, domain_request_counts).
class CreateAnalyticsDailyMetrics < ActiveRecord::Migration[8.0]
  def change
    create_table :analytics_daily_metrics do |t|
      t.bigint :account_id, null: false
      t.bigint :project_id, null: false
      t.date :date, null: false

      # Aggregated metrics
      t.integer :leads_count, default: 0, null: false
      t.bigint :page_views_count, default: 0, null: false
      t.bigint :impressions, default: 0, null: false
      t.bigint :clicks, default: 0, null: false
      t.bigint :cost_micros, default: 0, null: false

      t.timestamps
    end

    # Unique constraint for idempotent upserts during daily computation
    add_index :analytics_daily_metrics, [:account_id, :project_id, :date],
              unique: true, name: "idx_analytics_daily_acct_proj_date"

    # For dashboard queries: get all metrics for an account in a date range
    add_index :analytics_daily_metrics, [:account_id, :date],
              name: "idx_analytics_daily_acct_date"

    # For project-specific queries
    add_index :analytics_daily_metrics, [:project_id, :date],
              name: "idx_analytics_daily_proj_date"

    # Foreign keys - safe on new table creation
    safety_assured do
      add_foreign_key :analytics_daily_metrics, :accounts
      add_foreign_key :analytics_daily_metrics, :projects
    end
  end
end
