# == Schema Information
#
# Table name: tier_limits
#
#  id           :bigint           not null, primary key
#  plan_id      :bigint
#  plan_tier_id :bigint
#  limit_type   :string
#  limit        :integer
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_tier_limits_on_created_at              (created_at)
#  index_tier_limits_on_limit                   (limit)
#  index_tier_limits_on_limit_type              (limit_type)
#  index_tier_limits_on_plan_id                 (plan_id)
#  index_tier_limits_on_plan_id_and_limit_type  (plan_id,limit_type) UNIQUE
#  index_tier_limits_on_plan_tier_id            (plan_tier_id)
#

class TierLimit < ApplicationRecord
  belongs_to :plan_tier, touch: true

  validates :limit_type, presence: true, uniqueness: {scope: :plan_tier_id}
  validates :limit, presence: true, numericality: {greater_than_or_equal_to: 0}
end
