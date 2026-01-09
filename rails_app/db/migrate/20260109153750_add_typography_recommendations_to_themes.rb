class AddTypographyRecommendationsToThemes < ActiveRecord::Migration[8.0]
  def change
    add_column :themes, :typography_recommendations, :jsonb
  end
end
