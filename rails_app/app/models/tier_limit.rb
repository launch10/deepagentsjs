# == Schema Information
#
# Table name: tier_limits
#
#  id         :bigint           not null, primary key
#  limit      :integer
#  limit_type :string
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  tier_id    :bigint
#
# Indexes
#
#  index_tier_limits_on_created_at              (created_at)
#  index_tier_limits_on_limit                   (limit)
#  index_tier_limits_on_limit_type              (limit_type)
#  index_tier_limits_on_tier_id                 (tier_id)
#  index_tier_limits_on_tier_id_and_limit_type  (tier_id,limit_type) UNIQUE
#

class TierLimit < ApplicationRecord
  belongs_to :tier, class_name: "PlanTier", touch: true

  validates :limit_type, presence: true, uniqueness: {scope: :tier_id}
  validates :limit, presence: true, numericality: {greater_than_or_equal_to: 0}
end
