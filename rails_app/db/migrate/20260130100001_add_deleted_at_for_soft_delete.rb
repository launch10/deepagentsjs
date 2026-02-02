class AddDeletedAtForSoftDelete < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    tables = %i[
      brainstorms chats project_workflows social_links
      website_files domains website_urls deploys
      website_deploys website_leads analytics_daily_metrics
      campaign_deploys ad_performance_daily
      website_file_histories website_histories
    ]

    tables.each do |table|
      add_column table, :deleted_at, :datetime, if_not_exists: true
      add_index table, :deleted_at, algorithm: :concurrently, if_not_exists: true
    end
  end
end
