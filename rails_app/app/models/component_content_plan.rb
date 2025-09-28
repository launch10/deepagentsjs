# == Schema Information
#
# Table name: component_content_plans
#
#  id                    :integer          not null, primary key
#  component_overview_id :integer          not null
#  component_type        :string
#  data                  :jsonb            default("{}"), not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  component_id          :integer
#
# Indexes
#
#  index_component_content_plans_on_component_id           (component_id)
#  index_component_content_plans_on_component_overview_id  (component_overview_id)
#  index_component_content_plans_on_component_type         (component_type)
#  index_component_content_plans_on_created_at             (created_at)
#  index_component_content_plans_on_data                   (data)
#

class ComponentContentPlan < ApplicationRecord
  belongs_to :component_overview
end
