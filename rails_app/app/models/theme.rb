# == Schema Information
#
# Table name: themes
#
#  id         :integer          not null, primary key
#  name       :string           not null
#  colors     :jsonb            default("{}")
#  theme      :jsonb            default("{}")
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_themes_on_name  (name)
#

class Theme < ApplicationRecord
  has_many :theme_to_theme_labels, dependent: :destroy
  has_many :theme_labels, through: :theme_to_theme_labels
  alias_method :labels, :theme_labels

  scope :with_label, ->(label) do 
    joins(theme_labels: :theme_to_theme_labels).
      where("theme_labels.name = ?", label)
  end
end
