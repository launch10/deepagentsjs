class BackfillCommunityThemeCssVars < ActiveRecord::Migration[8.0]
  def up
    Theme.where(theme_type: "community").find_each do |theme|
      next if theme.colors.blank?

      expanded = Themes::ColorExpander.expand(theme.colors)
      theme.update_columns(theme: expanded, updated_at: Time.current)
    rescue => e
      Rails.logger.error("Failed to expand theme #{theme.id}: #{e.message}")
    end
  end

  def down
    # No-op: we don't want to remove expanded themes
  end
end
