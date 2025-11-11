# == Schema Information
#
# Table name: themes_to_theme_labels
#
#  id             :integer          not null, primary key
#  theme_id       :integer          not null
#  theme_label_id :integer          not null
#
# Indexes
#
#  index_themes_to_theme_labels_on_theme_id                     (theme_id)
#  index_themes_to_theme_labels_on_theme_id_and_theme_label_id  (theme_id,theme_label_id)
#  index_themes_to_theme_labels_on_theme_label_id               (theme_label_id)
#

class ThemeToThemeLabel < ApplicationRecord
  self.table_name = "themes_to_theme_labels"

  belongs_to :theme
  belongs_to :theme_label

  validates :theme_id, uniqueness: {scope: :theme_label_id}
end
