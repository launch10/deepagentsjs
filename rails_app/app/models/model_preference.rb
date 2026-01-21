# == Schema Information
#
# Table name: model_preferences
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
#  idx_model_preferences_unique  (cost_tier,speed_tier,skill) UNIQUE
#
class ModelPreference < ApplicationRecord
  include LanggraphCacheClearable

  # Valid values for each tier/skill
  COST_TIERS = %w[free paid].freeze
  SPEED_TIERS = %w[blazing fast slow].freeze
  SKILLS = %w[planning writing coding reasoning].freeze

  validates :cost_tier, presence: true, inclusion: { in: COST_TIERS }
  validates :speed_tier, presence: true, inclusion: { in: SPEED_TIERS }
  validates :skill, presence: true, inclusion: { in: SKILLS }
  validates :cost_tier, uniqueness: { scope: [:speed_tier, :skill] }

  # Find a preference by its tier and skill combination
  def self.for(cost_tier, speed_tier, skill)
    find_by(cost_tier: cost_tier, speed_tier: speed_tier, skill: skill)
  end

  # Returns all preferences as a nested hash structure:
  # { "paid" => { "slow" => { "coding" => ["opus", "sonnet", ...] } } }
  def self.all_preferences
    all.each_with_object({}) do |pref, result|
      result[pref.cost_tier] ||= {}
      result[pref.cost_tier][pref.speed_tier] ||= {}
      result[pref.cost_tier][pref.speed_tier][pref.skill] = pref.model_keys
    end
  end
end
