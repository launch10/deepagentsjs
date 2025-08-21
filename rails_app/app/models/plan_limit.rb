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
  after_destroy_commit :sync_plan_to_atlas

  private

  def sync_plan_to_atlas
    # Touch the plan to trigger its Atlas sync
    plan.sync_to_atlas if plan&.respond_to?(:sync_to_atlas)
  end
end
