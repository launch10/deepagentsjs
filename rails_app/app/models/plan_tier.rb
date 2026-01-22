# == Schema Information
#
# Table name: plan_tiers
#
#  id          :bigint           not null, primary key
#  description :string
#  details     :jsonb
#  name        :string           not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_plan_tiers_on_name  (name) UNIQUE
#

class PlanTier < ApplicationRecord
  has_many :plans, dependent: :nullify
  has_many :tier_limits, foreign_key: :tier_id, dependent: :destroy, inverse_of: :tier
  alias_method :limits, :tier_limits

  store_accessor :details, :features, :credits

  validates :name, presence: true, uniqueness: true

  # Ensure credits is always an integer
  def credits
    super.to_i
  end

  def credits=(value)
    super(value.to_i)
  end

  # Get a specific limit
  def limit_for(limit_type)
    tier_limits.find_by(limit_type: limit_type)&.limit || 0
  end

  def display_name
    name.titleize
  end
end
