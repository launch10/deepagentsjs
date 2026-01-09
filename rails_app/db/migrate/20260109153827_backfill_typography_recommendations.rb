class BackfillTypographyRecommendations < ActiveRecord::Migration[8.0]
  def up
    Theme.find_each do |theme|
      next if theme.colors.blank? || theme.pairings.blank?

      recommendations = ThemeConcerns::TypographyRecommendations.compute_recommendations(
        theme.colors,
        theme.pairings
      )

      theme.update_columns(
        typography_recommendations: recommendations,
        updated_at: Time.current
      )
    rescue => e
      Rails.logger.error("Failed to backfill typography for theme #{theme.id}: #{e.message}")
    end
  end

  def down
    Theme.update_all(typography_recommendations: nil)
  end
end
