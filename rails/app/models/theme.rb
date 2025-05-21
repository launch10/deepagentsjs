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
end
