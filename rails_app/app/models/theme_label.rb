# == Schema Information
#
# Table name: theme_labels
#
#  id   :bigint           not null, primary key
#  name :string           not null
#
# Indexes
#
#  index_theme_labels_on_name  (name)
#

class ThemeLabel < ApplicationRecord
  has_many :theme_to_theme_labels, dependent: :destroy
  has_many :themes, through: :theme_to_theme_labels
end
