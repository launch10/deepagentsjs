# == Schema Information
#
# Table name: plan_limits
#
#  id         :integer          not null, primary key
#  plan_id    :integer
#  limit_type :string
#  limit      :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_plan_limits_on_created_at  (created_at)
#  index_plan_limits_on_limit       (limit)
#  index_plan_limits_on_limit_type  (limit_type)
#  index_plan_limits_on_plan_id     (plan_id)
#

class PlanLimit < ApplicationRecord
  belongs_to :plan
end
