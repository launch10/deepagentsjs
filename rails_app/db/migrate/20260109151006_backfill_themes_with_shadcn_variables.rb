class BackfillThemesWithShadcnVariables < ActiveRecord::Migration[8.0]
  def up
    # Regenerate all theme CSS variables with shadcn naming convention
    # This updates --background-foreground to --foreground, etc.
    Theme.find_each do |theme|
      next if theme.colors.blank?

      theme_vars = ThemeConcerns::SemanticVariables.create_semantic_variables(theme.colors)
      pairings = ThemeConcerns::SemanticVariables.compute_pairings(theme.colors)

      theme.update_columns(
        theme: theme_vars,
        pairings: pairings,
        updated_at: Time.current
      )
    rescue => e
      Rails.logger.error("Failed to regenerate theme #{theme.id}: #{e.message}")
    end
  end

  def down
    # No-op: old variable names are no longer supported
  end
end
