# == Schema Information
#
# Table name: components
#
#  id                        :integer          not null, primary key
#  website_id                :integer          not null
#  page_id                   :integer          not null
#  name                      :string           not null
#  path                      :string
#  component_type            :string
#  file_specification_id     :integer          not null
#  theme_variant_id          :integer
#  component_overview_id     :integer
#  component_content_plan_id :integer
#  created_at                :datetime         not null
#  updated_at                :datetime         not null
#  website_file_id           :integer
#
# Indexes
#
#  index_components_on_component_content_plan_id  (component_content_plan_id)
#  index_components_on_component_overview_id      (component_overview_id)
#  index_components_on_component_type             (component_type)
#  index_components_on_file_specification_id      (file_specification_id)
#  index_components_on_name                       (name)
#  index_components_on_page_id                    (page_id)
#  index_components_on_page_id_and_name           (page_id,name) UNIQUE
#  index_components_on_theme_variant_id           (theme_variant_id)
#  index_components_on_website_file_id            (website_file_id)
#  index_components_on_website_id                 (website_id)
#  index_components_on_website_id_and_path        (website_id,path) UNIQUE
#

class Component < ApplicationRecord
  belongs_to :component_overview
  belongs_to :component_content_plan
  alias_method :content_plan, :component_content_plan
end
