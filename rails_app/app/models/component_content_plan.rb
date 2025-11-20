# == Schema Information
#
# Table name: component_content_plans
#
#  id                    :bigint           not null, primary key
#  component_type        :string
#  data                  :jsonb            not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  component_id          :integer
#  component_overview_id :bigint           not null
#
# Indexes
#
#  index_component_content_plans_on_component_id           (component_id)
#  index_component_content_plans_on_component_overview_id  (component_overview_id)
#  index_component_content_plans_on_component_type         (component_type)
#  index_component_content_plans_on_created_at             (created_at)
#  index_component_content_plans_on_data                   (data) USING gin
#

class ComponentContentPlan < ApplicationRecord
  belongs_to :component_overview
end
