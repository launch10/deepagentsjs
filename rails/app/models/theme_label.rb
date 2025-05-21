# == Schema Information
#
# Table name: theme_labels
#
#  id         :integer          not null, primary key
#  name       :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_theme_labels_on_name  (name)
#

class ThemeLabel < ApplicationRecord
end
