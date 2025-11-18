class AddAudienceToContentStrategies < ActiveRecord::Migration[8.0]
  def change
    add_column :content_strategies, :audience, :string
  end
end
