# == Schema Information
#
# Table name: sections
#
#  id              :integer          not null, primary key
#  name            :string
#  page_id         :integer          not null
#  component_id    :string           not null
#  file_id         :integer
#  theme_variation :string
#  content_plan    :jsonb            default("{}")
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_sections_on_component_id  (component_id)
#  index_sections_on_created_at    (created_at)
#  index_sections_on_file_id       (file_id)
#  index_sections_on_page_id       (page_id)
#

class Section < ApplicationRecord
end
