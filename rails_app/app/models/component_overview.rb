# == Schema Information
#
# Table name: component_overviews
#
#  id                    :bigint           not null, primary key
#  background_color      :string
#  component_type        :string
#  context               :string
#  copy                  :string
#  name                  :string
#  path                  :string
#  purpose               :string
#  sort_order            :integer
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  component_id          :bigint
#  file_specification_id :bigint
#  page_id               :bigint
#  website_id            :bigint           not null
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
#  index_component_overviews_on_sort_order             (sort_order)
#  index_component_overviews_on_website_id             (website_id)
#

class ComponentOverview < ApplicationRecord
  belongs_to :page_plan
  belongs_to :website
  belongs_to :page
  belongs_to :component
  belongs_to :file_specification
end
