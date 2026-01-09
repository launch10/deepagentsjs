class BackfillThemePairings < ActiveRecord::Migration[8.0]
  def up
    Theme.find_each do |theme|
      next if theme.colors.blank?

      pairings = ThemeConcerns::SemanticVariables.compute_pairings(theme.colors)
      theme.update_columns(pairings: pairings, updated_at: Time.current)
    rescue => e
      Rails.logger.error("Failed to compute pairings for theme #{theme.id}: #{e.message}")
    end
  end

  def down
    # No-op: we don't want to remove computed pairings
  end
end
