class AddNotNullToThemeType < ActiveRecord::Migration[8.0]
  def change
    add_check_constraint :themes, "theme_type IS NOT NULL", name: "themes_theme_type_null", validate: false
  end
end
