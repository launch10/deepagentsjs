class ValidateAddNotNullToThemeType < ActiveRecord::Migration[8.0]
  def up
    validate_check_constraint :themes, name: "themes_theme_type_null"
    change_column_null :themes, :theme_type, false
    remove_check_constraint :themes, name: "themes_theme_type_null"
  end

  def down
    add_check_constraint :themes, "theme_type IS NOT NULL", name: "themes_theme_type_null", validate: false
    change_column_null :themes, :theme_type, true
  end
end
