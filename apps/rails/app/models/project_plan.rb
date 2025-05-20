# == Schema Information
#
# Table name: project_plans
#
#  id                    :integer          not null, primary key
#  project_id            :integer          not null
#  tone                  :string           not null
#  core_emotional_driver :string
#  attention_grabber     :string
#  problem_statement     :string
#  emotional_bridge      :string
#  product_reveal        :string
#  social_proof          :string
#  urgency_hook          :string
#  call_to_action        :string
#  page_mood             :string
#  visual_evocation      :string
#  landing_page_copy     :text
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_project_plans_on_created_at  (created_at)
#  index_project_plans_on_project_id  (project_id)
#  index_project_plans_on_updated_at  (updated_at)
#

class ProjectPlan < ApplicationRecord
  belongs_to :project
end
