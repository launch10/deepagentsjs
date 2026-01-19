class AddDeletedAtToWebsiteHistories < ActiveRecord::Migration[8.0]
  def change
    add_column :website_histories, :deleted_at, :datetime
  end
end
