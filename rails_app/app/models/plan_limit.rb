# == Schema Information
#
# Table name: plan_limits
#
#  id         :bigint           not null, primary key
#  limit      :integer
#  limit_type :string
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  plan_id    :bigint
#
# Indexes
#
#  index_plan_limits_on_created_at              (created_at)
#  index_plan_limits_on_limit                   (limit)
#  index_plan_limits_on_limit_type              (limit_type)
#  index_plan_limits_on_plan_id                 (plan_id)
#  index_plan_limits_on_plan_id_and_limit_type  (plan_id,limit_type) UNIQUE
#

class PlanLimit < ApplicationRecord
  belongs_to :plan, touch: true

  after_create_commit :sync_plan_to_atlas
  after_update_commit :sync_plan_to_atlas

  private

  def sync_plan_to_atlas
    plan.send(:sync_to_atlas_on_update)
  end
end
