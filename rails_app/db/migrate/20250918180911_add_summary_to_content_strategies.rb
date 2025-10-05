class AddSummaryToContentStrategies < ActiveRecord::Migration[8.0]
  def change
    add_column :content_strategies, :summary, :text
  end
end
