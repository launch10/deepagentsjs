# Cached AI-generated insights for the dashboard.
# One record per account, regenerated when stale (>24 hours).
class CreateDashboardInsights < ActiveRecord::Migration[8.0]
  def change
    create_table :dashboard_insights do |t|
      t.bigint :account_id, null: false
      t.jsonb :insights, null: false, default: []
      t.jsonb :metrics_summary  # Snapshot of metrics used for generation
      t.datetime :generated_at, null: false

      t.timestamps
    end

    # One record per account
    add_index :dashboard_insights, :account_id, unique: true

    # Foreign key - safe on new table creation
    safety_assured { add_foreign_key :dashboard_insights, :accounts }
  end
end
