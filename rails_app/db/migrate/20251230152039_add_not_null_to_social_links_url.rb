class AddNotNullToSocialLinksUrl < ActiveRecord::Migration[8.0]
  def change
    # Safe to use safety_assured because:
    # 1. social_links is a new table with no existing data
    # 2. No NULL values exist to cause the migration to fail
    safety_assured { change_column_null :social_links, :url, false }
  end
end
