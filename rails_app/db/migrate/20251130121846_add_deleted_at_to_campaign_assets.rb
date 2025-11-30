class AddDeletedAtToCampaignAssets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    tables = %w[
      campaigns ad_groups ads
      ad_budgets ad_callouts
      ad_descriptions ad_headlines
      ad_keywords ad_languages ad_location_targets
      ad_schedules ads_accounts ad_structured_snippets
    ]

    tables.each do |table|
      unless column_exists?(table.to_sym, :deleted_at)
        add_column table.to_sym, :deleted_at, :datetime
        add_index table.to_sym, :deleted_at, algorithm: :concurrently
      end
    end
  end
end
