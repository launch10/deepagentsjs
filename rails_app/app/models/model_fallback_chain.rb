# == Schema Information
#
# Table name: model_fallback_chains
#
#  id         :bigint           not null, primary key
#  cost_tier  :string           not null
#  model_keys :string           default([]), not null, is an Array
#  skill      :string           not null
#  speed_tier :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  idx_fallback_chains_unique  (cost_tier,speed_tier,skill) UNIQUE
#
class ModelFallbackChain < ApplicationRecord
  # Valid values for each tier/skill
  COST_TIERS = %w[free paid].freeze
  SPEED_TIERS = %w[blazing fast slow].freeze
  SKILLS = %w[planning writing coding reasoning].freeze

  validates :cost_tier, presence: true, inclusion: { in: COST_TIERS }
  validates :speed_tier, presence: true, inclusion: { in: SPEED_TIERS }
  validates :skill, presence: true, inclusion: { in: SKILLS }
  validates :cost_tier, uniqueness: { scope: [:speed_tier, :skill] }

  # Find a fallback chain by its tier and skill combination
  def self.for(cost_tier, speed_tier, skill)
    find_by(cost_tier: cost_tier, speed_tier: speed_tier, skill: skill)
  end

  # Returns all chains as a nested hash structure:
  # { "paid" => { "slow" => { "coding" => ["opus", "sonnet", ...] } } }
  def self.all_chains
    all.each_with_object({}) do |chain, result|
      result[chain.cost_tier] ||= {}
      result[chain.cost_tier][chain.speed_tier] ||= {}
      result[chain.cost_tier][chain.speed_tier][chain.skill] = chain.model_keys
    end
  end
end
