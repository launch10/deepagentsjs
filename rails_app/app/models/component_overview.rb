# == Schema Information
#
# Table name: component_overviews
#
#  id                    :integer          not null, primary key
#  website_id            :integer          not null
#  page_id               :integer
#  component_type        :string
#  name                  :string
#  path                  :string
#  component_id          :integer
#  file_specification_id :integer
#  purpose               :string
#  context               :string
#  copy                  :string
#  background_color      :string
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_component_overviews_on_component_id           (component_id)
#  index_component_overviews_on_component_type         (component_type)
#  index_component_overviews_on_created_at             (created_at)
#  index_component_overviews_on_file_specification_id  (file_specification_id)
#  index_component_overviews_on_name                   (name)
#  index_component_overviews_on_page_id                (page_id)
#  index_component_overviews_on_path                   (path)
#  index_component_overviews_on_website_id             (website_id)
#

class ComponentOverview < ApplicationRecord
  belongs_to :page_plan
  belongs_to :website
  belongs_to :page
  belongs_to :component
  belongs_to :file_specification
end
