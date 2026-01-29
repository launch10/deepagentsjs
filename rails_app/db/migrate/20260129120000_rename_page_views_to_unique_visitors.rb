# frozen_string_literal: true

# Renames page_views_count to unique_visitors_count to accurately reflect
# that we're counting Ahoy visits (sessions), not page views.
# Adds a new page_views_count column for actual page view events.
class RenamePageViewsToUniqueVisitors < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      # Rename existing column to reflect what it actually measures
      rename_column :analytics_daily_metrics, :page_views_count, :unique_visitors_count

      # Add new column for actual page views (from Ahoy::Event)
      add_column :analytics_daily_metrics, :page_views_count, :bigint, default: 0, null: false
    end
  end
end
