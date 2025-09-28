# == Schema Information
#
# Table name: theme_variants
#
#  id               :integer          not null, primary key
#  background_class :string           not null
#  foreground_class :string
#  muted_class      :string
#  primary_class    :string
#  secondary_class  :string
#  accent_class     :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#
# Indexes
#
#  index_theme_variants_on_background_class  (background_class) UNIQUE
#  index_theme_variants_on_created_at        (created_at)
#

class ThemeVariant < ApplicationRecord
end
